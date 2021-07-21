/*	Snap Manager
	Unofficial snap manager for usual snap tasks
	GNOME Shell extension
	(c) Francois Thirioux 2021
	License: GPLv3  */
	

const { Clutter, Gio, GLib, GObject, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;
const MessageTray = imports.ui.messageTray;
const Urgency = imports.ui.messageTray.Urgency;

// refresh counter extension file
var refreshFileCounter = Me.path + "/refreshCount";
var refreshFileList = Me.path + "/refreshList";
var refreshFileTime = Me.path + "/refreshTime";
var refreshFileNext = Me.path + "/refreshNext";

// refresh notification after session start-up
var REFRESH_NOTIFICATION = true;
// wait some time for network connection and refresh command output (s)
var WAIT_NETWORK_TIMEOUT = 60;
// wait some time for refresh command output (s)
var WAIT_REFRESH_LIST = 10;

// here you can add/remove/hack the actions
var menuActions =	[	
	["List installed snaps", "echo List installed snaps; echo; snap list"],
	["List recent snap changes", "echo List recent snap changes; echo; snap changes"],
	["List available snap refresh", "echo List available snap refresh; echo; snap refresh --list"],
	["Refresh installed snaps", "echo Refresh installed snaps; echo; snap refresh"],
	["Install snap...", "echo Install snap...; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter channel (void=default): ' snapchannel; echo; snap install $snapname --channel=$snapchannel"],
	["Remove snap...", "echo Remove snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap remove $snapname"],
];

// here you can add/remove/hack the snap options					
var menuSnapOptions = [
	["Snap info...", "echo Snap info...; echo; read -p 'Enter snap name: ' snapname; echo; snap info --verbose $snapname"],
	["Refresh snap channel...", "echo Refresh snap channel...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter new channel: ' snapchannel; echo; snap refresh $snapname --channel=$snapchannel"],
	["Revert snap refresh...", "echo Revert snap refresh...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap revert $snapname"],
	["Enable snap...", "echo Enable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap enable $snapname"],
	["Disable snap...", "echo Disable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap disable $snapname"],						
];
						
// here you can add/remove/hack the snap connections					
var menuSnapConnections = [
	["List available interfaces", "echo List available interfaces; echo; snap interface"],
	["List snap connections...", "echo List snap connections...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname"],
	["Connect snap...", "echo Connect snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname; echo; read -p 'Enter interface to connect: ' snapconnection; echo; snap connect $snapname:$snapconnection"],
	["Disconnect snap...", "echo Disconnect snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available connections:; snap connections $snapname; echo; read -p 'Enter interface to disconnect: ' snapconnection; echo; snap disconnect $snapname:$snapconnection"],
];
						
// here you can add/remove/hack the hold refresh time options
var menuRefreshOptions = [
	["Refresh schedule", "echo Refresh schedule; echo; snap refresh --time"],
	["Hold auto refresh for one hour", "echo Hold auto refresh for one hour; echo; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 hour'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Hold auto refresh for one day", "echo Hold auto refresh for one day; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 day'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Hold auto refresh for one week", "echo Hold auto refresh for one week; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 week'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Hold auto refresh for one month", "echo Hold auto refresh for one month; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 month'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
	["Cancel hold auto refresh", "echo Cancel auto refresh delay; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '0 second'); echo; echo Refresh schedule; echo; snap refresh --time"],
];

// define local Gio snap symbolic icon					
var iconPath = Me.path + "/snap-symbolic.svg";
var snapIcon = Gio.icon_new_for_string(iconPath);

// snap menu
var SnapMenu = GObject.registerClass(
class SnapMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Snap manager');
        
		// make indicator
        this.hbox = new St.BoxLayout({style_class: 'panel-status-menu-box'});
		this.icon = new St.Icon({gicon: snapIcon, style_class: 'system-status-icon'});
        this.hbox.add_child(this.icon);
        this.hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.add_child(this.hbox);
        
        // initial available snap updates check after some delay
        if (REFRESH_NOTIFICATION) {
			Main.layoutManager.connect('startup-complete', () => {
				this.refreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, WAIT_NETWORK_TIMEOUT, this._refreshNotification.bind(this));
			});
		}
        
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
		
		// run Snap Store snap app
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction("Run Snap Store application", _ => {
			Util.trySpawnCommandLine("snap-store");
		});
		
		// open Snap Store in default browser
		this.menu.addAction("Open Snap Store website", _ => {
			Util.trySpawnCommandLine("xdg-open https://snapcraft.io/store");
		});
    }
    
    // notify if available snap updates
    _refreshNotification() {
    	GLib.spawn_command_line_async("bash -c 'refreshcount=$(snap refresh --list | wc -l); echo $refreshcount > " + refreshFileCounter + "'");
    	GLib.spawn_command_line_async("bash -c 'snap refresh --list > " + refreshFileList + "'");
		GLib.spawn_command_line_async("bash -c 'snap refresh --time | grep hold > " + refreshFileTime + "'");
		GLib.spawn_command_line_async("bash -c 'snap refresh --time | grep next > " + refreshFileNext + "'");

    	this.waitRefreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, WAIT_REFRESH_LIST, () => {
			// hold updates
			this.file = Gio.File.new_for_path(refreshFileTime);
			this.fileContent = this.file.load_contents(null)[1];
			this.refreshTime = ByteArray.toString(this.fileContent).slice(0,-1).split('hold:')[1];
			if (this.refreshTime) {
				this.refreshTime = this.refreshTime.split(',')[0]
				this.refreshTime = "Auto updates disabled, reactivation" + this.refreshTime;
			} else {
				this.file = Gio.File.new_for_path(refreshFileNext);
				this.fileContent = this.file.load_contents(null)[1];
				this.refreshNext = ByteArray.toString(this.fileContent).slice(0,-1).split('next:')[1].split(',')[0];
				this.refreshTime = "Auto updates enabled, next" + this.refreshNext;
			}

			// available refresh count
			this.file = Gio.File.new_for_path(refreshFileCounter);
			this.fileContent = this.file.load_contents(null)[1];
			this.refreshCounter = Number(ByteArray.toString(this.fileContent).slice(0,-1)) - 1;
			
			// refresh list
			this.file = Gio.File.new_for_path(refreshFileList);
			this.fileContent = this.file.load_contents(null)[1];
			this.refreshList = ByteArray.toString(this.fileContent).slice(0,-1).split('\n').map(x => x.split(' ', 1));
			this.refreshNames = "";
			for (let k = 1; k < this.refreshList.length; k++) {
				this.refreshNames += this.refreshList[k][0]+" ; ";
			}
			this.refreshNames = this.refreshNames.slice(0, -3);
			
			// create notification
			this.notificationSource = new MessageTray.Source('snap-manager-extension', 'dialog-information-symbolic');
			Main.messageTray.add(this.notificationSource);
			this.notificationSource.createIcon = function() {
				return new St.Icon({ gicon: snapIcon, style_class: 'system-status-icon' });
			}
			this.notificationTitle = "Snap Manager";
			switch (this.refreshCounter) {
				case -1:
				   	this.notificationMessage = "No snap refresh available\n\n" + this.refreshTime;
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					break;
				case 1:
					this.notificationMessage = "Refresh available, 1 snap needs to be updated:\n" + this.refreshNames + "\n\n" + this.refreshTime;
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					this.notification.addAction("Refresh now", this._snapRefresh.bind(this));
					break;
				default:
					this.notificationMessage = "Refresh available, " + this.refreshCounter + " snaps need to be updated:\n" + this.refreshNames + "\n\n" + this.refreshTime;
					this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
					this.notification.addAction("Refresh now", this._snapRefresh.bind(this));
			}
			this.notification.urgency = Urgency.CRITICAL;
    		this.notification.addAction("Recent changes", this._snapChanges.bind(this));
    		this.notificationSource.showNotification(this.notification);
    	});
	};
	
    // launch bash command
    _executeAction(command) {
    	try {
			Util.trySpawnCommandLine("gnome-terminal -x bash -c \"echo Press Ctrl-C to cancel action.; echo; " + command + "; echo; echo --; read -n 1 -s -r -p 'Press any key to close...'\"");
		} catch(err) {
			Main.notify("Error: unable to execute command in GNOME Terminal");
		}
	}
	
	// snap refresh direct shortcut
	_snapRefresh() {
		this._executeAction("echo Refresh installed snaps; echo; snap refresh");
		this.notification.destroy();
	}
	
	// snap changes direct shortcut
	_snapChanges() {
		this._executeAction("echo List recent snap changes; echo; snap changes");
		this.notification.destroy();
	};
    
    // main menu items
    _addSnapMenuItem(item, index, array) {
    	if (index == 3) {
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    }

	    this.menu.addAction(item[0],_ => {
	    	this._executeAction(item[1]);
	    });
	}
	
	// snap options submenu items
	_addOptionsSubmenuItem(item, index, array) {
	    this.submenu1.menu.addAction(item[0], _ => {
	    	this._executeAction(item[1])
	    });
	}
	
	// snap connections submenu items
	_addConnectSubmenuItem(item, index, array) {
	    this.submenu2.menu.addAction(item[0], _ => {
	    	this._executeAction(item[1])
	    });
	}
	
	// refresh options submenu items
	_addRefreshSubmenuItem(item, index, array) {
	    this.submenu3.menu.addAction(item[0], _ => {
	    	this._executeAction(item[1])
	    });
	}
	
	_destroy() {
		if (this.refreshTimeout) {
			GLib.source_remove(this.refreshTimeout);
		}
		if (this.waitRefreshTimeout) {
			GLib.source_remove(this.waitRefreshTimeout);
		}
		super.destroy();
	}	
});

class Extension {
    enable() {
		this.snap_indicator = new SnapMenu();
    	Main.panel.addToStatusArea('snap-menu', this.snap_indicator);
    }

    disable() {
    	this.snap_indicator._destroy();
    }
}

function init() {
	return new Extension();
}
