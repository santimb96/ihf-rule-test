/**
 * Chunk fetched when the header statistics button is opened: the shared modal
 * shell and the statistics dialog. It pulls the question dataset with it
 * because a returning visitor can open the history before ever starting a test
 * in this page load.
 */
import "../../data/questions.js";
import "../dialog.js";
import "../screens/stats.js";
