  <tr>
    <td>Block Reward</td>
    <td>
      TODO
    </td>
  </tr>
  <tr>
    <td>Size</td>
    <td>
      TODO
    </td>
  </tr>
  <tr>
    <td>Compare to</td>
    <td>
    <%
    let endpoints = uiTool.getPublicWSEndpoints(chain);
    let polkadotJSURL = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(endpoints[0])}#/explorer/query/${b.hash}`; %>
      <a href='<%= polkadotJSURL; %>' target='_new'><img src="https://cdn.polkaholic.io/polkadotjs.svg" width="16"></a>
      <% if ( chain.subscanURL && false) {
         let subscanURL = `${chain.subscanURL}/block/${blockNumber}`;
         %>
      <a href='<%- subscanURL; %>' target='_new'><img src="https://cdn.polkaholic.io/subscan.svg" width="16"></a>
      <% } %>
      <% if ( chainID && (chainID == 2004 || chainID == 22023 || chainID == 61000) && b.evmBlock != undefined ) {
         let externalURL;
         let imgURL;
         if (chainID == 2004){
             externalURL = `https://moonscan.io`
             imgURL =  "https://cdn.polkaholic.io/moonscan.svg"
         }else if (chainID == 22023){
             externalURL = `https://moonriver.moonscan.io`
             imgURL =  "https://cdn.polkaholic.io/moonriverscan.svg"
         }else if (chainID == 61000){
             externalURL = `https://moonbase.moonscan.io`
             imgURL =  "https://polkadot.js.org/apps/static/moonbase_alpha.1299ae1a..png"
         }
         let txURL = `${externalURL}/block/${b.evmBlock.hash}`;
         %>
      <a href="<%= txURL; %>" target="_new"><img src="<%= imgURL; %>" width="16"></a>
      <% }%>
      <% if ( chainID && (chainID == 2006 || chainID == 22007) && b.evmBlock != undefined ) {
         let externalURL = (chainID == 2006)? `https://blockscout.com/astar` : `https://blockscout.com/shiden`
         let imgURL = "https://cdn.polkaholic.io/blockscout.png"
         let txURL = `${externalURL}/block/${b.evmBlock.hash}`;
         %>
      <a href="<%= txURL; %>" target="_new"><img src="<%= imgURL; %>" width="16"></a>
      <% }%>
    </td>

  </tr>
