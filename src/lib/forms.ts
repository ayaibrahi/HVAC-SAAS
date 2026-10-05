export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(
    Array.from(formData.entries()).filter(([key]) => !key.startsWith("$ACTION_")),
  );
}
