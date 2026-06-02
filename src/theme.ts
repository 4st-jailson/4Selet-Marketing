import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const interFamily = loadInter("normal", {
  weights: ["400", "500", "700", "900"],
  subsets: ["latin"],
}).fontFamily;

export const monoFamily = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
}).fontFamily;

export const COLORS = {
  darker: "#07212B",
  darkest: "#050C12",
  navy: "#003554",
  blue: "#006494",
  sky: "#5499B5",
  mist: "#AFBCC9",
  cloud: "#D9DCD6",
} as const;
