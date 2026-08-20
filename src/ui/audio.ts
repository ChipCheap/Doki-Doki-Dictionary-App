/**
 * H6 — the audio seam.
 *
 * v1 ships NO audio. Browser speech synthesis was evaluated by listening and
 * rejected: the available Vietnamese voices do not render tones reliably, and a
 * voice that flattens a tone teaches the wrong word — the same failure mode as a
 * fabricated example sentence, and equally invisible to a learner.
 *
 * What exists here is the seam, so adding audio later means implementing behind
 * a call site rather than retrofitting call sites into finished screens. No
 * control renders while `isAvailable` is false; a dead button is worse than an
 * absent one.
 */

export interface SpeechRequest {
  text: string;
  /** BCP-47 tag, e.g. `vi-VN`. */
  language: string;
}

/**
 * Whether playback can be offered at all.
 *
 * Hard-coded false. When this becomes real it should probe for a voice in the
 * requested language and stay false when none exists, so the control is absent
 * rather than disabled on systems without the language pack.
 */
export function isAvailable(_language: string): boolean {
  return false;
}

/** No-op. Callers must check `isAvailable` first and render nothing if false. */
export function speak(_request: SpeechRequest): void {
  // Intentionally empty — see the module comment.
}
