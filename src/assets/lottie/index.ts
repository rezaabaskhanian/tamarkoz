/**
 * Lottie animations (JSON from LottieFiles / After Effects), played by
 * components/Celebration.tsx with lottie-react-native.
 *
 * - courseDone: confetti, on a completed session
 * - streak: flame, the streak tile on home
 * - correct: check mark, a completed session's badge
 * - wrong: bouncy fail, when the lock broke
 * - reviewDone: every written-down thought has been dealt with
 * - goal: today's goal reached (session summary)
 * - rocket: a study marathon was created
 * - paymentSuccess / paymentFailed: purchase result dialogs
 *
 * Rule: animations only for moments of reward, never during a session, on the lock
 * screen or in sleep/rest — they would pull attention away from studying.
 */
import type { AnimationObject } from 'lottie-react-native';

export type CelebrationKind =
  | 'courseDone'
  | 'streak'
  | 'correct'
  | 'wrong'
  | 'reviewDone'
  | 'goal'
  | 'rocket'
  | 'paymentSuccess'
  | 'paymentFailed';

export const LOTTIE_SOURCES: Record<CelebrationKind, AnimationObject> = {
  courseDone: require('./course-done.json'),
  streak: require('./streak.json'),
  correct: require('./correct.json'),
  wrong: require('./wrong.json'),
  reviewDone: require('./review-done.json'),
  goal: require('./checklist_target.json'),
  rocket: require('./rocket.json'),
  paymentSuccess: require('./payment_success.json'),
  paymentFailed: require('./payment_failed.json'),
};
