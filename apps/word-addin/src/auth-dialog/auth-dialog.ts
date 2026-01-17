/**
 * Auth Dialog Entry Point - MINIMAL TEST VERSION
 * Just to verify the dialog loads at all
 */

console.log('[Auth Dialog] Script starting...');
console.log('[Auth Dialog] URL:', window.location.href);

// Show immediate feedback
document.body.innerHTML = `
  <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
    <h2>Dialog Loaded!</h2>
    <p>URL: ${window.location.href}</p>
    <p>Session ID: ${new URLSearchParams(window.location.search).get('sessionId') || 'none'}</p>
    <p id="status">Waiting for Office...</p>
  </div>
`;

function updateStatus(msg: string) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
  console.log('[Auth Dialog]', msg);
}

// Try Office.onReady
if (typeof Office !== 'undefined') {
  updateStatus('Office detected, waiting for onReady...');
  Office.onReady(() => {
    updateStatus('Office ready! Waiting 3 seconds...');

    // Wait a bit then try messageParent
    setTimeout(() => {
      updateStatus('Trying messageParent...');
      try {
        Office.context.ui.messageParent(JSON.stringify({ test: true }));
        updateStatus('messageParent called!');
      } catch (e) {
        updateStatus('messageParent failed: ' + (e as Error).message);
      }
    }, 3000);
  });
} else {
  updateStatus('Office not available (not in Office context)');
}
