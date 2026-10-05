import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  agencyUsageLimitConfig,
  enforceAgencyUsageLimit,
  runWithAgencyUsageLimit,
  type UsageLimitAction,
} from "@/features/usage/limits";
import { AppError } from "@/lib/errors";

vi.mock("server-only", () => ({}));

describe("agency usage limits", () => {
  it("allows the first valid request and rejects once the agency window is exhausted", async () => {
    const store = createFakeUsageLimitStore();
    const config = agencyUsageLimitConfig.website_analyzer;

    await expect(
      enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "website_analyzer",
        admin: store.admin,
        now: () => 0,
      }),
    ).resolves.toMatchObject({
      remaining: config.maxRequests - 1,
    });

    for (let index = 1; index < config.maxRequests; index += 1) {
      await enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "website_analyzer",
        admin: store.admin,
        now: () => 0,
      });
    }

    await expect(
      enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "website_analyzer",
        admin: store.admin,
        now: () => 0,
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("isolates allowance by agency and prevents user-spoofed agency consumption", async () => {
    const store = createFakeUsageLimitStore([
      ["agency-1", "user-1"],
      ["agency-2", "user-2"],
    ]);

    await enforceAgencyUsageLimit({
      agencyId: "agency-1",
      userId: "user-1",
      action: "proposal_ai",
      admin: store.admin,
      now: () => 0,
    });

    await expect(
      enforceAgencyUsageLimit({
        agencyId: "agency-2",
        userId: "user-2",
        action: "proposal_ai",
        admin: store.admin,
        now: () => 0,
      }),
    ).resolves.toMatchObject({
      remaining: agencyUsageLimitConfig.proposal_ai.maxRequests - 1,
    });

    await expect(
      enforceAgencyUsageLimit({
        agencyId: "agency-2",
        userId: "user-1",
        action: "proposal_ai",
        admin: store.admin,
        now: () => 0,
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(store.getCount("agency-2", "proposal_ai", 0)).toBe(1);
  });

  it("resets allowance when the configured window changes", async () => {
    const store = createFakeUsageLimitStore();
    const config = agencyUsageLimitConfig.opportunity_ai;

    for (let index = 0; index < config.maxRequests; index += 1) {
      await enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "opportunity_ai",
        admin: store.admin,
        now: () => 0,
      });
    }

    await expect(
      enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "opportunity_ai",
        admin: store.admin,
        now: () => config.windowMs,
      }),
    ).resolves.toMatchObject({
      remaining: config.maxRequests - 1,
    });
  });

  it("does not run the expensive operation when the limit rejects", async () => {
    const store = createFakeUsageLimitStore();
    const config = agencyUsageLimitConfig.proposal_ai;
    let expensiveCalls = 0;

    for (let index = 0; index < config.maxRequests; index += 1) {
      await enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "proposal_ai",
        admin: store.admin,
        now: () => 0,
      });
    }

    await expect(
      runWithAgencyUsageLimit(
        {
          agencyId: "agency-1",
          userId: "user-1",
          action: "proposal_ai",
          admin: store.admin,
          now: () => 0,
        },
        async () => {
          expensiveCalls += 1;
          return "expensive result";
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 429,
    });

    expect(expensiveCalls).toBe(0);
  });

  it("uses the atomic RPC result so concurrent requests cannot exceed the window limit", async () => {
    const store = createFakeUsageLimitStore();
    const config = agencyUsageLimitConfig.proposal_ai;
    const requests = Array.from({ length: config.maxRequests + 5 }, () =>
      enforceAgencyUsageLimit({
        agencyId: "agency-1",
        userId: "user-1",
        action: "proposal_ai",
        admin: store.admin,
        now: () => 0,
      }).then(
        () => true,
        () => false,
      ),
    );

    await expect(Promise.all(requests)).resolves.toHaveLength(
      config.maxRequests + 5,
    );
    const results = await Promise.all(requests);

    expect(results.filter(Boolean)).toHaveLength(config.maxRequests);
    expect(store.getCount("agency-1", "proposal_ai", 0)).toBe(
      config.maxRequests,
    );
  });
});

function createFakeUsageLimitStore(
  owners: Array<[agencyId: string, userId: string]> = [["agency-1", "user-1"]],
) {
  const ownerByAgency = new Map(owners);
  const buckets = new Map<string, number>();

  return {
    admin: {
      rpc(name: string, args: RateLimitRpcArgs) {
        expect(name).toBe("consume_agency_rate_limit");

        return {
          async single() {
            if (ownerByAgency.get(args.p_agency_id) !== args.p_requested_by) {
              return {
                data: null,
                error: { code: "42501", message: "agency_user_not_authorized" },
              };
            }

            const key = createBucketKey(
              args.p_agency_id,
              args.p_action_key,
              Date.parse(args.p_window_start),
            );
            const currentCount = buckets.get(key) ?? 0;

            if (currentCount >= args.p_max_requests) {
              return {
                data: {
                  allowed: false,
                  remaining: 0,
                  reset_at: new Date(
                    Date.parse(args.p_window_start) +
                      args.p_window_seconds * 1000,
                  ).toISOString(),
                },
                error: null,
              };
            }

            const nextCount = currentCount + 1;
            buckets.set(key, nextCount);

            return {
              data: {
                allowed: true,
                remaining: args.p_max_requests - nextCount,
                reset_at: new Date(
                  Date.parse(args.p_window_start) +
                    args.p_window_seconds * 1000,
                ).toISOString(),
              },
              error: null,
            };
          },
        };
      },
    } as unknown as Parameters<typeof enforceAgencyUsageLimit>[0]["admin"],
    getCount(agencyId: string, action: UsageLimitAction, windowStartMs: number) {
      return buckets.get(createBucketKey(agencyId, action, windowStartMs)) ?? 0;
    },
  };
}

type RateLimitRpcArgs = {
  p_agency_id: string;
  p_action_key: UsageLimitAction;
  p_window_start: string;
  p_window_seconds: number;
  p_max_requests: number;
  p_requested_by: string;
};

function createBucketKey(
  agencyId: string,
  action: UsageLimitAction,
  windowStartMs: number,
) {
  return `${agencyId}:${action}:${windowStartMs}`;
}
