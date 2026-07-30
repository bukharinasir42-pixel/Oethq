import crypto from "crypto";
import type { Request, Response } from "express";
import { PlanTier, Role, SubscriptionStatus } from "@prisma/client";
import type { AppConfig } from "../../common/app-config";
import { BunnyPlaybackService } from "../../modules/media/bunny-playback.service";
import { pickEffectiveSubscriptionForAccess } from "../../modules/subscriptions/subscription-access.utils";
import type { AppContainer } from "../container";
import { getTaskEmbed } from "./tasks.router";

jest.mock("../../modules/subscriptions/subscription-access.utils", () => ({
  pickEffectiveSubscriptionForAccess: jest.fn()
}));

const pickEffectiveSubscriptionForAccessMock = pickEffectiveSubscriptionForAccess as jest.MockedFunction<
  typeof pickEffectiveSubscriptionForAccess
>;

type PrismaStub = {
  subscription: { findMany: jest.Mock };
  dailyTask: { findUnique: jest.Mock };
};

type ResponseStub = {
  statusCode: number;
  status: jest.Mock;
  set: jest.Mock;
  json: jest.Mock;
};

function config(values: Record<string, string | undefined> = {}): AppConfig {
  return {
    get<T = string>(key: string, defaultValue?: T): T | undefined {
      const value = values[key];
      return (value === undefined || value === "" ? defaultValue : value) as T | undefined;
    }
  };
}

function configuredBunnyPlaybackService() {
  return new BunnyPlaybackService(
    config({
      BUNNY_STREAM_LIBRARY_ID: "library-123",
      BUNNY_STREAM_EMBED_TOKEN_KEY: "bunny-test-key"
    })
  );
}

function activeSubscription() {
  return {
    status: SubscriptionStatus.ACTIVE,
    plan: { tier: PlanTier.STARTER }
  };
}

function container(prisma: PrismaStub): AppContainer {
  return {
    prisma,
    bunnyPlaybackService: configuredBunnyPlaybackService()
  } as unknown as AppContainer;
}

function request(slot = "lecture") {
  return {
    query: { slot },
    params: { dayNumber: "1" },
    user: { id: "user-123", role: Role.CANDIDATE }
  } as unknown as Request;
}

function response(): ResponseStub {
  const res: ResponseStub = {
    statusCode: 200,
    status: jest.fn(),
    set: jest.fn(),
    json: jest.fn()
  };
  res.status.mockImplementation((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });
  res.set.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("GET /tasks/:dayNumber/embed", () => {
  let prisma: PrismaStub;

  beforeEach(() => {
    prisma = {
      subscription: { findMany: jest.fn() },
      dailyTask: { findUnique: jest.fn() }
    };
    pickEffectiveSubscriptionForAccessMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 403 before looking up a task when the user has no active subscription", async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    pickEffectiveSubscriptionForAccessMock.mockReturnValue(null);
    const res = response();

    await getTaskEmbed(container(prisma), request(), res as unknown as Response);

    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith({ error: "No active subscription" });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
      },
      include: { plan: true }
    });
    expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when an entitled user has no Bunny video for the requested slot", async () => {
    prisma.subscription.findMany.mockResolvedValue([activeSubscription()]);
    pickEffectiveSubscriptionForAccessMock.mockReturnValue(activeSubscription());
    prisma.dailyTask.findUnique.mockResolvedValue({ lectureBunnyVideoId: null, articleBunnyVideoId: null });
    const res = response();

    await getTaskEmbed(container(prisma), request(), res as unknown as Response);

    expect(res.statusCode).toBe(404);
    expect(res.json).toHaveBeenCalledWith({ error: "No video for this lesson" });
  });

  it("returns 403 when a starter user requests a locked core skills embed", async () => {
    prisma.subscription.findMany.mockResolvedValue([activeSubscription()]);
    pickEffectiveSubscriptionForAccessMock.mockReturnValue(activeSubscription());
    prisma.dailyTask.findUnique.mockResolvedValue({ lectureBunnyVideoId: null, articleBunnyVideoId: "coreskill-video" });
    const res = response();

    await getTaskEmbed(container(prisma), request("coreskill"), res as unknown as Response);

    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Core skills video not included in your plan" });
    expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
  });

  it("returns a private, no-store signed Bunny embed URL for an entitled user", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    prisma.subscription.findMany.mockResolvedValue([activeSubscription()]);
    pickEffectiveSubscriptionForAccessMock.mockReturnValue(activeSubscription());
    prisma.dailyTask.findUnique.mockResolvedValue({ lectureBunnyVideoId: "lecture-video", articleBunnyVideoId: null });
    const expires = 1_700_003_600;
    const token = crypto.createHash("sha256").update(`bunny-test-keylecture-video${expires}`).digest("hex");
    const res = response();

    await getTaskEmbed(container(prisma), request(), res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.json).toHaveBeenCalledWith({
      provider: "bunny",
      embedUrl: `https://iframe.mediadelivery.net/embed/library-123/lecture-video?token=${token}&expires=${expires}&autoplay=false&preload=true`,
      expiresAt: "2023-11-14T23:13:20.000Z"
    });
  });
});
