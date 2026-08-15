// Host loader entry for a browser-only plugin.
//
// The client half (lib/client.js) does all the work inside the browser;
// there is nothing to do on the Node host side. The host loader still
// imports this entry once per row, so we export a no-op apply.
export function apply() {}
