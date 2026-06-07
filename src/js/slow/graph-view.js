/**
 * Back-compat re-exports — canonical implementation lives in src/js/graph/.
 */
export {
  buildEnrichedGraph,
  buildSlowEnrichedGraph,
  buildRsvpMaterialGraph,
  buildSessionGraph,
} from "../graph/build.js?v=20260607_1";

export {
  buildGraphSubgraphMarkdown,
  mountEnrichedGraphScreen,
  mountMaterialGraphScreen,
  persistEnrichedGraph,
  renderEnrichedGraphHtml,
  renderGraphUnlockButtonHtml,
  wireEnrichedGraphScreen,
  wireMaterialGraphScreen,
} from "../graph/view.js?v=20260607_1";

export { argNodeId, blockNodeId, conceptNodeId, textNodeId, userNodeId } from "../graph/ids.js?v=20260607_1";
