/*	Snap Manager
	Unofficial snap manager for usual snap tasks
	GNOME Shell extension
	(c) Francois Thirioux 2020
	License: GPLv3 */
	

const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const ByteArray = imports.byteArray;
const MessageTray = imports.ui.messageTray;
const Urgency = imports.ui.messageTray.Urgency;

// refresh counter extension file
const refreshFileCounter = Me.path + "/refreshCount";
const refreshFileList = Me.path + "/refreshList";

// refresh nofitication after session startup
const REFRESH_NOTIFICATION = true;
// wait some time for network connection and refresh command output (s)
const WAIT_NETWORK_TIMEOUT = 20;
// wait some time for refresh command output (s)
const WAIT_REFRESH_LIST = 10;

// here you can add/remove/hack the actions
var menuActions =	[	
						["List installed snaps", "echo List installed snaps; echo; snap list"],
						["List recent snap changes", "echo List recent snap changes; echo; snap changes"],
						["List available snap refresh", "echo List available snap refresh; echo; snap refresh --list"],
						["Refresh installed snaps", "echo Refresh installed snaps; echo; snap refresh"],
						["Install snap...", "echo Install snap...; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter channel (void=default): ' snapchannel; echo; snap install $snapname --channel=$snapchannel"],
						["Remove snap...", "echo Remove snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap remove $snapname"]
					];

// here you can add/remove/hack the snap options					
var menuSnapOptions = [
	["Snap info...", "echo Snap info...; echo; read -p 'Enter snap name: ' snapname; echo; snap info --verbose $snapname"],
	["Refresh snap channel...", "echo Refresh snap channel...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter new channel: ' snapchannel; echo; snap refresh $snapname --channel=$snapchannel"],
	["Revert snap refresh...", "echo Revert snap refresh...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap revert $snapname"],
	["Enable snap...", "echo Enable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap enable $snapname"],
	["Disable snap...", "echo Disable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap disable $snapname"]							
];
						
// here you can add/remove/hack the snap connections					
var menuSnapConnections = [
	["List available interfaces", "echo List available interfaces; echo; snap interface"],
	["List snap connections...", "echo List snap connections...; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname"],
	["Connect snap...", "echo Connect snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname; echo; read -p 'Enter interface to connect: ' snapconnection; echo; snap connect $snapname:$snapconnection"],
	["Disconnect snap...", "echo Disconnect snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname; echo; read -p 'Enter interface to disconnect: ' snapconnection; echo; snap disconnect $snapname:$snapconnection"],
];
						
// here you can add/remove/hack the hold refresh time options
var menuRefreshOptions = [
	["Refresh schedule", "echo Refresh schedule; echo; snap refresh --time"],
	["Hold auto refresh for one hour", "echo Hold auto refresh for one hour; echo; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 hour'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Hold auto refresh for one day", "echo Hold auto refresh for one day; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 day'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Hold auto refresh for one week", "echo Hold auto refresh for one week; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 week'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Cancel auto refresh delay", "echo Cancel auto refresh delay; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '0 second'); echo; echo Refresh schedule; echo; snap refresh --time"]
];

// define local Gio snap symbolic icon					
var iconPath = Me.path + "/snap-symbolic.svg";
var snapIcon = Gio.icon_new_for_string(this.iconPath);

// snap menu
var SnapMenu = GObject.registerClass(
class SnapMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Snap manager');
        
		// make indicator
        this.hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		this.icon = new St.Icon({ gicon: snapIcon, style_class: 'system-status-icon' });
        this.hbox.add_child(this.icon);
        this.hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.add_child(this.hbox);
        
        // initial available snap updates check after some delay
        if (REFRESH_NOTIFICATION) {
			GLib.timeout_add_seconds(GLib.PRIORITY_LOW, WAIT_NETWORK_TIMEOUT, Lang.bind(this, function() {
				this._refreshNotification()
			}))
		};
        
		// main menu
		menuActions.forEach(this._addSnapMenuItem.bind(this));
		
		// snap configuration submenu
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.submenu1 = new PopupMenu.PopupSubMenuMenuItem('Snap options');
		this.menu.addMenuItem(this.submenu1);
		menuSnapOptions.forEach(this._addOptionsSubmenuItem.bind(this));
		
		// snap connections submenu
		this.submenu2 = new PopupMenu.PopupSubMenuMenuItem('Snap connections');
		this.menu.addMenuItem(this.submenu2);
		menuSnapConnections.forEach(this._addConnectSubmenuItem.bind(this));
		
		// refresh options submenu
		this.submenu3 = new PopupMenu.PopupSubMenuMenuItem('Refresh options');
		this.menu.addMenuItem(this.submenu3);
		menuRefreshOptions.forEach(this._addRefreshSubmenuItem.bind(this));
		
		// open Snap Store in default browser
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction("Open Snap Store website", event => {
			Util.trySpawnCommandLine("xdg-open https://snapcraft.io/store");
		})
    };
    
    // notify if available snap updates
    _refreshNotification() {
    	GLib.spawn_command_line_async("bash -c 'refreshcount=$(snap refresh --list | wc -l); echo $refreshcount > " + refreshFileCounter + "'");
    	GLib.spawn_command_line_async("bash -c 'snap refresh --list > " + refreshFileList + "'");
    	GLib.timeout_add_seconds(GLib.PRIORITY_LOW, WAIT_REFRESH_LIST, Lang.bind(this, function() {
			// write available refresh count
			this.file = Gio.File.new_for_path(refreshFileCounter);
			this.fileContent = this.file.load_contents(null)[1];
			this.refreshCounter = Number(ByteArray.toString(this.fileContent).slice(0,-1)) - 1;
			
			// write refresh list
			this.file = Gio.File.new_for_path(refreshFileList);
			this.fileContent = this.file.load_contents(null)[1];
			this.refreshList = ByteArray.toString(this.fileContent).slice(0,-1);
			
			// remove previous snap manager notifications (=> don't stack them)
			for (let source of Main.messageTray.getSources()) {
    			if (source.title == 'snap-manager-extension') {
    				source.destroy();
    			}
    		};
			
			// create notification
			this.notificationSource = new MessageTray.Source('snap-manager-extension', 'dialog-information-symbolic');
			Main.messageTray.add(this.notificationSource);
			this.notificationSource.createIcon = function() {
				return new St.Icon({ gicon: snapIcon, style_class: 'system-status-icon' });
			};
			switch (this.refreshCounter) {
				case -1:
					this.notificationTitle = "Snap Manager";
				   	this.notificationMessage = "No snap refresh available";
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					this.notification.urgency = Urgency.NORMAL;
					break;
				case 1:
					this.notificationTitle = "Snap Manager";
					this.notificationMessage = "Refresh available: 1 snap needs to be updated\n\n" + this.refreshList;
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					this.notification.urgency = Urgency.CRITICAL;
					this.notification.addAction("Refresh now", Lang.bind(this, this._snapRefresh));
					break;
				default:
					this.notificationTitle = "Snap Manager";
					this.notificationMessage = "Refresh available: " + this.refreshCounter + " snaps need to be updated\n\n" + this.refreshList;
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					this.notification.urgency = Urgency.CRITICAL;
					this.notification.addAction("Refresh now", Lang.bind(this, this._snapRefresh));
			};
    		this.notification.addAction("Recent changes", Lang.bind(this, this._snapChanges));
    		this.notificationSource.showNotification(this.notification);
    	}));
	};
	
    // launch bash command
    _executeAction(command) {
    	try {
    			Util.trySpawnCommandLine("gnome-terminal -x bash -c \"echo Press Ctrl-C to cancel action.; echo; " + command + "; echo; echo --; read -n 1 -s -r -p 'Press any key to close...'\"");
			} catch(err) {
    			Main.notify("Error: unable to execute command in GNOME Terminal");
		};
	};
	
	// snap refresh direct shortcut
	_snapRefresh() {
		this._executeAction("echo Refresh installed snaps; echo; snap refresh");
		this.notification.destroy();
	};
	
	// snap changes direct shortcut
	_snapChanges() {
		this._executeAction("echo List recent snap changes; echo; snap changes");
		this.notification.destroy();
	};
    
    // main menu items
    _addSnapMenuItem(item, index, array) {
    	if (index == 3) {
	    		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    };
	    this.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	};
	
	// snap options submenu items
	_addOptionsSubmenuItem(item, index, array) {
	    this.submenu1.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	};
	
	// snap connections submenu items
	_addConnectSubmenuItem(item, index, array) {
	    this.submenu2.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	};
	
	// refresh options submenu items
	_addRefreshSubmenuItem(item, index, array) {
	    this.submenu3.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	}
});

function init() {
}

var _indicator;

function enable() {
    _indicator = new SnapMenu();
    Main.panel.addToStatusArea('snap-menu', _indicator);
}

function disable() {
    _indicator.destroy();
}
