$ErrorActionPreference = 'Stop'
$memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
if ($memory.AvailableBytes -lt 4GB -or $disk.FreeSpace -lt 8GB) { throw 'Resource gate failed; browser not started.' }
$info = [System.Diagnostics.ProcessStartInfo]::new()
$info.FileName = (Get-Command node -ErrorAction Stop).Source
$info.WorkingDirectory = $PSScriptRoot
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
foreach ($argument in @('--test', '--test-concurrency=1', '--test-timeout=60000', 'dist/prototype.test.js')) { $info.ArgumentList.Add($argument) }
# Do not inherit DB/provider credentials, DEBUG settings or NODE_OPTIONS.
$info.Environment.Clear()
foreach ($name in @('SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)')) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ($value) { $info.Environment[$name] = $value }
}
$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $info
$clock = [System.Diagnostics.Stopwatch]::StartNew()
[void]$process.Start()
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
$known = [System.Collections.Generic.HashSet[int]]::new()
[void]$known.Add($process.Id)
$cpuMax = @{}
$peakWorkingSet = 0L
$peakPrivate = 0L
$minAvailable = [long]$memory.AvailableBytes
$sampleCount = 0
$timedOut = $false
try {
  while (-not $process.HasExited) {
    if ($clock.Elapsed.TotalSeconds -gt 65) { $timedOut = $true; $process.Kill($true); break }
    $all = @(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,PrivatePageCount,KernelModeTime,UserModeTime)
    do {
      $added = $false
      foreach ($item in $all) {
        if ($known.Contains([int]$item.ParentProcessId) -and $known.Add([int]$item.ProcessId)) { $added = $true }
      }
    } while ($added)
    $tree = @($all | Where-Object { $known.Contains([int]$_.ProcessId) })
    $working = [long]($tree | Measure-Object WorkingSetSize -Sum).Sum
    $private = [long]($tree | Measure-Object PrivatePageCount -Sum).Sum
    $peakWorkingSet = [math]::Max($peakWorkingSet, $working)
    $peakPrivate = [math]::Max($peakPrivate, $private)
    foreach ($item in $tree) { $cpuMax[[int]$item.ProcessId] = ([double]$item.KernelModeTime + [double]$item.UserModeTime) / 10000000 }
    $sample = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    $minAvailable = [math]::Min($minAvailable, [long]$sample.AvailableBytes)
    $sampleCount++
    Start-Sleep -Milliseconds 250
  }
  $process.WaitForExit()
} finally {
  if (-not $process.HasExited) { $process.Kill($true); $process.WaitForExit() }
}
$clock.Stop()
$textOut = $stdout.GetAwaiter().GetResult()
$textErr = $stderr.GetAwaiter().GetResult()
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'dist/test-output.txt'), $textOut + $textErr)
$after = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$diskAfter = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$remaining = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $known.Contains($_.Id) })
$metrics = [ordered]@{
  ExitCode=$process.ExitCode; SupervisorTimeout=$timedOut; WallSeconds=[math]::Round($clock.Elapsed.TotalSeconds,3)
  SampleCount=$sampleCount; SampledPeakTreeWorkingSetMiB=[math]::Round($peakWorkingSet/1MB,2)
  SampledPeakTreePrivateMiB=[math]::Round($peakPrivate/1MB,2)
  ObservedTreeCPUSeconds=[math]::Round(($cpuMax.Values | Measure-Object -Sum).Sum,3)
  AvailableBeforeGiB=[math]::Round($memory.AvailableBytes/1GB,3); MinimumSampledAvailableGiB=[math]::Round($minAvailable/1GB,3)
  AvailableAfterGiB=[math]::Round($after.AvailableBytes/1GB,3)
  DiskBeforeGiB=[math]::Round($disk.FreeSpace/1GB,3); DiskAfterGiB=[math]::Round($diskAfter.FreeSpace/1GB,3)
  RemainingTrackedProcesses=$remaining.Count
}
$json = $metrics | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'dist/resource-metrics.json'), $json)
Write-Output $textOut
if ($textErr) { Write-Output $textErr }
Write-Output $json
exit $process.ExitCode
