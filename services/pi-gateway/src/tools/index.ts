import { analyzeArxivTool } from "./analyze-arxiv.js";
import { analyzeGithubTool } from "./analyze-github.js";
import { searchAiDiveTool } from "./search-ai-dive.js";
import { getArticleContentTool } from "./get-article-content.js";
import { getIntelDayTool } from "./get-intel-day.js";
import { webSearchTool } from "./web-search.js";
import { fetchWebPageTool } from "./fetch-web-page.js";

export const READER_TOOLS = [
  analyzeArxivTool,
  analyzeGithubTool,
  searchAiDiveTool,
  getArticleContentTool,
  getIntelDayTool,
  webSearchTool,
  fetchWebPageTool,
];
