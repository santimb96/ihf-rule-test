/**
 * Publishes the catalogue metadata before scripts/data.js runs. The question
 * dataset itself is a separate chunk imported on the first "Comenzar test", so
 * this is all the entry bundle knows about the catalogue.
 */
import { meta, topics, counts } from "virtual:ihf-catalogue-meta";

globalThis.IHF_META = { meta: meta, topics: topics, counts: counts };
