/**
 * Chunk fetched when the test starts: the hint component and the quiz screen.
 * Imports are static so the bundler emits one request with the right execution
 * order (the screen reads IHFRender/IHFData/IHFHint at load time).
 */
import "../hint.js";
import "../screens/quiz.js";
