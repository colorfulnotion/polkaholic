
function showxcminfo(xcmInfo) {
  document.getElementById("origination").innerHTML = showOrigination(xcmInfo.origination)
  document.getElementById("relayed").innerHTML = showRelayed(xcmInfo.relayed)
  document.getElementById("destination").innerHTML = showDestination(xcmInfo.destination)
}

function showOrigination(origination) {
  return "origination:" + JSON.stringify(origination)
/*
<h6 class="fw-bold">
 <% if ( xcm.origination.paraID == 0 ) { %>
   Origination [RelayChain] <%= uiTool.capitalizeFirstLetter(xcm.origination.id) %>
 <%} else {  %>
   Origination [Para ID: <%= xcm.origination.paraID %>]: <%= uiTool.capitalizeFirstLetter(xcm.origination.id) %>
 <% } %>
</h6>

<p class="text-muted mb-2 fw-bold"><%- uiTool.presentTS(xcm.origination.ts) %></p>
<p class="mb-2">
  <B>Sent</B>: <span class="fw-bold"><%- uiTool.presentFloat(xcm.origination.amountSent) %></span> <%= xcm.symbol; %> (<%= uiTool.currencyFormat(xcm.origination.amountSentUSD)%>)<br/>
</p>
<p class="text-muted">
<% if ( xcm.origination.transactionHash ) { %>
 <B> Transaction Hash: </b><%- uiTool.presentTx(xcm.origination.transactionHash) %>
<% } else { %>
 <B> Extrinsic ID: </B> <%- uiTool.presentExtrinsicID(xcm.origination.extrinsicID, xcm.origination.extrinsicHash); %>
<% } %>
<br/>

<B>Sender:</B>
<% if ( xcm.origination.sender ) {
  let sender = xcm.origination.sender
%>
<%- uiTool.presentBlockiesOrIdenticon(sender, 25) %>
<%- uiTool.presentID(sender); %>

<% } %>
<br/>

<B>Module</B>: <%- include("module", {chainID: xcm.origination.id, section: xcm.origination.section, method: xcm.origination.method}); %><br/>
<b>Sent At Block</B>: <a href='/block/<%= xcm.origination.id %>/<%= xcm.origination.blockNumber; %>'><code><%= xcm.origination.blockNumber; %></code></a><br/>
<b>XCM Message Hash</b>: <a href='/xcmmessage/<%= xcm.origination.msgHash %>/<%= xcm.origination.sentAt %>'><%- uiTool.getShortHash(xcm.origination.msgHash) %></a><br/>
<% if ( xcm.origination.txFee != undefined) { %>
<B>TX Fees:</B>
   <%- uiTool.presentFloat(xcm.origination.txFee) %> <%= xcm.origination.txFeeSymbol %>
   (<%- uiTool.currencyFormat(xcm.origination.txFeeUSD, xcm.priceUSD, xcm.priceUSDCurrent) %>)<br/>
<% } %>
</p>
*/
}


function showRelayed(relayed) {
  return "relayed:" + JSON.stringify(relayed)
/*
<h6 class="fw-bold">
Relay Chain: <%= xcm.relayChain.relayChain; %>
</h6>

<p class="text-muted">
<% if ( xcm.relayChain.relayAt ) { %>
<B>Relayed At Block:</B>
<a href='/block/<%= xcm.relayChain.relayChain %>/<%= xcm.relayChain.relayAt; %>'>
  <code><%= xcm.relayChain.relayAt; %></code>
</a>
*/
}

function showDestination(destination)
{
  return "destination:" + JSON.stringify(destination)
/*
<h6 class="fw-bold">
  <% if ( xcm.destination.paraID == 0 ) { %>
  Destination: [RelayChain]</B> <%= uiTool.capitalizeFirstLetter(xcm.destination.id) %>
  <% } else { %>
  Destination: [Para ID: <%= xcm.destination.paraID %>]</B> <%= uiTool.capitalizeFirstLetter(xcm.destination.id) %>
  <% } %>
</h6>
<% if ( xcm.destination.ts ) { %>
<p class="text-muted mb-2 fw-bold"><%- uiTool.presentTS(xcm.destination.ts) %></p>
<% } %>
<p class="mb-2">
 <B>Received</B>: <span class="fw-bold"><%- uiTool.presentFloat(xcm.destination.amountReceived) %></span> <%= xcm.symbol; %> (<%= uiTool.currencyFormat(xcm.destination.amountReceivedUSD)%>)<br/>
</p>
<p class="text-muted">
 <% if ( xcm.destination.blockNumber ) { %>
 <B> Received At Block:</B> <a href='/block/<%= xcm.destination.id %>/<%= xcm.destination.blockNumber %>'>
   <code><%= xcm.destination.blockNumber %></a></code>
 <br/>
 <% } %>

 <B>Beneficiary:</B>
 <% if ( xcm.destination.beneficiary ) {
     let beneficiary = xcm.destination.beneficiary;
 %>
 <%- uiTool.presentBlockiesOrIdenticon(beneficiary, 25) %>
 <%- uiTool.presentID(beneficiary); %>
 <% } %>
 <br/>

<B>Execution Status:</B>
 <% if ( xcm.destination.status ) { %>
<button type="button" class="btn btn-success text-capitalize">Success</button>
 <% } else { %>
   <% if ( xcm.destination.error ) { %>
<button type="button" class="btn btn-danger text-capitalize"><%= xcm.destination.error.errorType %></button><br/>
      <%= xcm.destination.error.errorDesc; %><br/>
<% } %>
 <% } %>
<br/>
<% if ( xcm.destination.eventID ) { %>
   <B> Event ID:</B> <%= xcm.destination.eventID %><br/>
<%- include("eventaccordion", {eventID: xcm.destination.eventID}); %>
<% } %>
<br/>
 <% if ( xcm.destination.teleportFee ) { %>
<p class="text-muted">
<B>Teleport Fees:</B>
<%- uiTool.presentFloat(xcm.destination.teleportFee) %> <%= xcm.destination.teleportFeeChainSymbol %> (<%- uiTool.currencyFormat(xcm.destination.teleportFeeUSD, xcm.priceUSD, xcm.priceUSDCurrent) %>)
</p>
 <% } %>
 */
}
