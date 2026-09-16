import QtQuick
import QtQuick.Controls

// One menu for text bubbles and link previews. Actions stay in BlipView,
// using the same clipboard, browser and share-sheet paths as before.
Menu {
  id: menu
  implicitWidth: 250
  padding: 6
  background: Rectangle {
    color: menu.palette.window
    border.color: Qt.alpha(menu.palette.windowText, 0.25)
    radius: 7
  }
  property string linkUrl: ""
  property bool canQuote: false
  property bool canCopy: false
  signal quoteRequested()
  signal copyRequested()
  signal openRequested(string url)
  signal copyLinkRequested(string url)
  signal shareRequested(string url)

  MenuItem {
    text: "Quote and reply"
    visible: menu.linkUrl === ""
    height: visible ? implicitHeight : 0
    enabled: visible && menu.canQuote
    onTriggered: menu.quoteRequested()
  }
  MenuItem {
    text: "Copy message"
    visible: menu.linkUrl === ""
    height: visible ? implicitHeight : 0
    enabled: visible && menu.canCopy
    onTriggered: menu.copyRequested()
  }
  MenuItem {
    text: "Open in browser"
    visible: menu.linkUrl !== ""
    enabled: visible
    height: visible ? implicitHeight : 0
    onTriggered: menu.openRequested(menu.linkUrl)
  }
  MenuItem {
    text: "Copy link"
    visible: menu.linkUrl !== ""
    enabled: visible
    height: visible ? implicitHeight : 0
    onTriggered: menu.copyLinkRequested(menu.linkUrl)
  }
  MenuItem {
    text: "Share link…"
    visible: menu.linkUrl !== ""
    enabled: visible
    height: visible ? implicitHeight : 0
    onTriggered: menu.shareRequested(menu.linkUrl)
  }
}
