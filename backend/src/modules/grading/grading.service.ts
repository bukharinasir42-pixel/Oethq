import { BandLabel } from "@prisma/client";

type BandDefinition = {
  min: number;
  max: number;
  label: BandLabel;
  passProbability: number;
  scoreRange: string;
  displayProbability: string;
};

const BANDS: BandDefinition[] = [
  { min: 0, max: 19, label: BandLabel.CRITICAL, passProbability: 8, scoreRange: "0-19", displayProbability: "<10%" },
  { min: 20, max: 22, label: BandLabel.AT_RISK, passProbability: 25, scoreRange: "20-22", displayProbability: "~25%" },
  { min: 23, max: 25, label: BandLabel.DEVELOPING, passProbability: 45, scoreRange: "23-25", displayProbability: "~45%" },
  { min: 26, max: 27, label: BandLabel.COMPETITIVE, passProbability: 62, scoreRange: "26-27", displayProbability: "~62%" },
  { min: 28, max: 29, label: BandLabel.STRONG, passProbability: 80, scoreRange: "28-29", displayProbability: "~80%" },
  { min: 30, max: 31, label: BandLabel.EXCELLENT, passProbability: 85, scoreRange: "30-31", displayProbability: "~85%" },
  { min: 32, max: 33, label: BandLabel.OUTSTANDING, passProbability: 92, scoreRange: "32-33", displayProbability: "~92%" },
  { min: 34, max: 42, label: BandLabel.ELITE, passProbability: 94, scoreRange: "34-42", displayProbability: "94%+" }
];

export class GradingService {
  getBands() {
    return BANDS.map(({ min, max, ...rest }) => ({
      ...rest,
      minScore: min,
      maxScore: max
    }));
  }

  getBandForScore(score: number) {
    const clampedScore = Math.max(0, Math.min(42, Math.round(score)));
    return BANDS.find((band) => clampedScore >= band.min && clampedScore <= band.max) ?? BANDS[0];
  }
}
