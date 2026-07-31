export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: string;
  subscriptions: {
    status: string;
    startDate: string | null;
    endDate: string | null;
    plan: { id: string; name: string; tier: string } | null;
  }[];
};

export type StorageAssetDto = {
  id: string;
  kind: string;
  bucket: string;
  objectKey: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  signedUrl: string;
  publicUrl?: string;
  /** True when the upload replaced an existing object at the same S3 key. */
  replaced?: boolean;
};

export type TestQuestionDto = {
  id: string;
  sequence: number;
  part: "A" | "B" | "C";
  extractId?: string | null;
  type: "MCQ" | "FILL_BLANK";
  content: string;
  options?: string[] | null;
  explanation?: string | null;
  points: number;
  correctAnswer?: string;
};

export type PastPaperTestRefDto = {
  id: string;
  title: string;
  type: "LISTENING" | "READING";
  isPublished?: boolean;
};

export type PastPaperSummaryDto = {
  id: string;
  title: string;
  description?: string | null;
  isPublished: boolean;
  listeningTest: PastPaperTestRefDto;
  readingTest: PastPaperTestRefDto;
};

export type TestSummaryDto = {
  id: string;
  type: "LISTENING" | "READING";
  title: string;
  description?: string | null;
  instructions?: string | null;
  partASubInstructions?: string | null;
  partBSubInstructions?: string | null;
  partCSubInstructions?: string | null;
  partABookletHtml?: string | null;
  partBBookletHtml?: string | null;
  partBExtractBooklets?: Record<string, string> | null;
  partCExtractBooklets?: Record<string, string> | null;
  partAExtractQuestionHeadings?: Record<string, string> | null;
  partAQuestionHeadingGroups?: Record<
    string,
    Array<{ id: string; heading: string; questionSequences: number[] }>
  > | null;
  partCExtractQuestionHeadings?: Record<string, string> | null;
  partCBookletHtml?: string | null;
  totalQuestions: number;
  timerDuration: number;
  partATimer?: number | null;
  partBCTimer?: number | null;
  isPublished: boolean;
  questionCount?: number;
  isImported?: boolean;
};

export type RetainedResultDto = {
  id: string;
  userId: string;
  testId: string;
  latestAttemptId?: string | null;
  score: number;
  partAScore?: number | null;
  partBScore?: number | null;
  partCScore?: number | null;
  /** Official OET scaled score (0–500) — present for imported/Rasch-scored tests. */
  scaledScore?: number | null;
  /** Official OET grade (A–E) — present for imported/Rasch-scored tests. */
  oetGrade?: string | null;
  bandLabel: string;
  passProbability: number;
  completedAt: string;
  attemptsCount: number;
  test: TestSummaryDto;
};

export type ListeningTrackDto = {
  id: string;
  sortOrder: number;
  label?: string | null;
  asset: StorageAssetDto | null;
};

export type TestDetailDto = TestSummaryDto & {
  audioAsset?: StorageAssetDto | null;
  bookletAsset?: StorageAssetDto | null;
  partBBookletAsset?: StorageAssetDto | null;
  partCBookletAsset?: StorageAssetDto | null;
  listeningTracks?: ListeningTrackDto[];
  latestResult?: RetainedResultDto | null;
  linkedPastPaper?: PastPaperSummaryDto | null;
  questions: TestQuestionDto[];
};

export type TestAttemptDto = {
  id: string;
  userId: string;
  testId: string;
  status: string;
  section: string;
  startedAt: string;
  expiresAt: string;
  sectionExpiresAt?: string | null;
  submittedAt?: string | null;
  autoSubmittedAt?: string | null;
  currentQuestionIndex: number;
  questionCountAnswered: number;
  timeRemainingSeconds?: number | null;
  audioPositionSeconds: number;
  audioCompleted: boolean;
  currentListeningTrackIndex: number;
  listeningFinalCountdownEndsAt?: string | null;
  countdownStartedAt?: string | null;
  answersJson?: Record<string, string> | null;
  score?: number | null;
  partAScore?: number | null;
  partBScore?: number | null;
  partCScore?: number | null;
  bandLabel?: string | null;
  passProbability?: number | null;
  updatedAt: string;
  test: TestDetailDto;
};

export type TaskItem = {
  id: string;
  dayNumber: number;
  title: string;
  summary?: string | null;
  lectureTitle: string;
  lectureUrl: string;
  lectureBunnyVideoId?: string | null;
  lectureAsset?: StorageAssetDto | null;
  lectureAssetId?: string | null;
  lectureThumbnailAsset?: StorageAssetDto | null;
  lectureThumbnailAssetId?: string | null;
  articleTitle: string;
  articleUrl: string;
  articleBunnyVideoId?: string | null;
  articleContent?: string | null;
  articleAsset?: StorageAssetDto | null;
  articleAssetId?: string | null;
  articleThumbnailAsset?: StorageAssetDto | null;
  articleThumbnailAssetId?: string | null;
  articlePdfAsset?: StorageAssetDto | null;
  articlePdfAssetId?: string | null;
  pastPaperTitle?: string | null;
  pastPaperUrl?: string | null;
  pastPaper?: PastPaperSummaryDto | null;
  cheatSheetAsset?: StorageAssetDto | null;
  cheatSheetAssetId?: string | null;
  readingTest?: TestSummaryDto | null;
  listeningTest?: TestSummaryDto | null;
  pastPaperTest?: TestSummaryDto | null;
  isPublished: boolean;
  readingLocked: boolean;
  listeningLocked: boolean;
  pastPaperLocked: boolean;
  lectureLocked: boolean;
  coreSkillsLocked: boolean;
  articleLocked: boolean;
  cheatSheetLocked: boolean;
};

export type TaskBuilderItem = Omit<
  TaskItem,
  | "readingLocked"
  | "listeningLocked"
  | "pastPaperLocked"
  | "lectureLocked"
  | "coreSkillsLocked"
  | "articleLocked"
  | "cheatSheetLocked"
>;

export type PlanDto = {
  id: string;
  name: string;
  tier: string;
  description?: string | null;
  price: number;
  currency: string;
  readingLimit: number;
  listeningLimit: number;
  pastPaperLimit: number;
  writingLimit?: number;
  durationDays: number;
  isActive?: boolean;
};

export type BlogType = "READING" | "SPEAKING" | "WRITING" | "LISTENING";

export type BlogDto = {
  id: string;
  title: string;
  description: string;
  blogType: BlogType;
  imageUrl: string | null;
  publishedAt: string | null;
};

/** Published article detail from `GET /blogs/public?id=…` (includes long-form HTML when set). */
export type PublicBlogDetailDto = BlogDto & {
  content: string | null;
};

export type PaginatedPublicBlogsDto = {
  items: BlogDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminBlogDto = {
  id: string;
  title: string;
  description: string;
  content: string | null;
  blogType: BlogType;
  imageAssetId: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl: string | null;
};

export type DashboardDto = {
  subscription?: {
    id: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    customAccessUrl?: string | null;
    plan: PlanDto;
  } | null;
  summary: {
    totalAttempts: number;
    retainedResults: number;
    averageScore: number;
    nasirBand?: string | null;
    passProbability: number;
  };
  breakdown: {
    readingAverage: number;
    listeningAverage: number;
  };
  retainedResults: RetainedResultDto[];
  recentAttempts: Array<{
    id: string;
    status: string;
    score?: number | null;
    bandLabel?: string | null;
    submittedAt?: string | null;
    updatedAt: string;
    test: TestSummaryDto;
  }>;
  activeAttempt?: {
    id: string;
    section: string;
    timeRemainingSeconds?: number | null;
    updatedAt: string;
    test: TestSummaryDto;
  } | null;
};

export type SubscribedUserDto = {
  subscriptionId: string;
  userId: string;
  name: string;
  email: string;
  plan: { id: string; name: string; tier: string };
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  currentBand?: string | null;
};

export type CandidateProgressSummaryDto = {
  userId: string;
  name: string;
  email: string;
  subscriptionId?: string | null;
  plan?: { id: string; name: string; tier: string } | null;
  subscriptionStatus?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currentBand?: string | null;
  latestPassProbability: number;
  retainedResultsCount: number;
  attemptsCount: number;
};

export type PaginatedCandidateProgressDto = {
  items: CandidateProgressSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type UserProgressDto = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  subscription?: {
    id: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    plan: PlanDto;
  } | null;
  summary: {
    testsTaken: number;
    retainedResults: number;
    latestBand?: string | null;
    latestPassProbability: number;
  };
  retainedResults: RetainedResultDto[];
  attempts: Array<{
    id: string;
    status: string;
    section: string;
    score?: number | null;
    bandLabel?: string | null;
    submittedAt?: string | null;
    updatedAt: string;
    test: TestSummaryDto;
  }>;
};

export type RegistryUserDto = {
  id: string;
  name: string;
  email: string;
  role: string;
  profession?: string | null;
  heardFrom?: string | null;
  createdAt: string;
  lastLogin: string | null;
  subscriptions: Array<{
    status: string;
    startDate: string | null;
    endDate: string | null;
    plan: { id: string; name: string; tier: string };
  }>;
};

export type AdminOverviewDto = {
  users: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  testsToday: number;
};

export type CreatedCustomUserDto = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  activationUrl: string;
  temporaryPassword?: string | null;
  otp?: string | null;
  /** Individual packages granted at creation. Live immediately — no activation. */
  grantedPackages?: { slug: string; name: string; endDate: string | null }[];
  /** Null when no Complete Course plan was attached (packages-only candidate). */
  activationEmail?: ActivationEmailPayloadDto | null;
};

export type AdminPurchaseDto = {
  id: string;
  userId: string;
  planId: string;
  amount: number | string;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  provider?: string | null;
  reference?: string | null;
  checkoutSessionId?: string | null;
  activationToken?: string | null;
  activationUrl?: string | null;
  retryCount: number;
  failureReason?: string | null;
  receiptUrl?: string | null;
  receiptData?: Record<string, unknown> | null;
  webhookEventId?: string | null;
  webhookPayload?: Record<string, unknown> | null;
  webhookReceivedAt?: string | null;
  completedAt?: string | null;
  emailSentAt?: string | null;
  upgradedFromTrial?: boolean;
  /** Derived kind for admin purchase history. */
  purchaseKind?: "TRIAL_UPGRADE" | "DIRECT_PAID";
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  plan: {
    id: string;
    name: string;
    tier: string;
  };
};

export type PurchaseIntentResponseDto = {
  purchase: AdminPurchaseDto;
  checkoutUrl: string;
};

export type ActivationEmailPayloadDto = {
  toName: string;
  toEmail: string;
  planName: string;
  otp: string;
  activationUrl: string;
  purchaseId: string;
};

export type PurchaseResolutionResponseDto = {
  purchase: AdminPurchaseDto;
  activationUrl?: string | null;
  otp?: string;
  activationEmail?: ActivationEmailPayloadDto;
  alreadyCompleted?: boolean;
};

export type HowToIntroductionDto = {
  id: string;
  title: string;
  videoAssetId: string | null;
  videoAsset: StorageAssetDto | null;
  videoUrl: string | null;
  thumbnailAssetId: string | null;
  thumbnailAsset: StorageAssetDto | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export type WebsiteHomeDto = {
  id: string;
  heroVideoAssetId: string | null;
  heroVideoAsset: StorageAssetDto | null;
  heroVideoUrl: string | null;
  updatedAt: string;
};
