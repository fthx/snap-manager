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

// color of snap icon when snap updates available (default = "#E95420")
const REFRESH_ICON_COLOR = "#E95420";

// here you can add/remove/hack the actions
var menuActions =	[	
						["List installed snaps", "echo List installed snaps; echo; snap list"],
						["List recent snap changes", "echo List recent snap changes; echo; snap changes"],
						["List snap updates", "echo List snap updates; echo; snap refresh --list"],
						["Refresh installed snaps", "echo Refresh installed snaps; echo; snap refresh"],
						["Install snap...", "echo Install snap...; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter channel (void=default): ' snapchannel; echo; snap install $snapname --channel=$snapchannel"],
						["Remove snap...", "echo Remove snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap remove $snapname"]
					];

// here you can add/remove/hack the extra actions					
var menuExtraActions = 	[
							["Refresh snap channel...", "echo Refresh snap channel...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; echo Available channels:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p 'Enter new channel: ' snapchannel; echo; snap refresh $snapname --channel=$snapchannel"],
							["Snap info...", "echo Snap info...; echo; read -p 'Enter snap name: ' snapname; echo; snap info $snapname"],
							["Find snap...", "echo Find snap...; echo; read -p 'Enter one word to search: ' snapsearch; echo; snap find $snapsearch"],
							["Enable snap...", "echo Enable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap enable $snapname"],
							["Disable snap...", "echo Disable snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap disable $snapname"]
						];
						
// here you can add/remove/hack the hold refresh time options
var menuRefreshOptions =	[
							["Refresh schedule", "echo Refresh schedule; echo; snap refresh --time"],
							["Hold auto refresh for one hour", "echo Hold auto refresh for one hour; echo; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 hour'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
							["Hold auto refresh for one day", "echo Hold auto refresh for one day; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 day'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
							["Hold auto refresh for one week", "echo Hold auto refresh for one week; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 week'); echo; echo Refresh schedule; echo; snap refresh --time | grep hold"],
							["Cancel auto refresh delay", "echo Cancel auto refresh delay; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '0 second'); echo; echo Refresh schedule; echo; snap refresh --time"]
						]

let SnapMenu = GObject.registerClass(
class SnapMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Snap manager');

		// make indicator
        this.hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        // import snap customized icon
        this.iconPath = Me.path + "/snap-symbolic.svg";
		this.gioIcon = Gio.icon_new_for_string(this.iconPath);
		this.icon = new St.Icon({ gicon: this.gioIcon, style_class: 'system-status-icon' });
		// desaturate your customized icon if you want to
		//this.iconEffect = new Clutter.DesaturateEffect();
		//this.icon.add_effect(this.iconEffect);
        // here you can add a menu label (step 1/2)
        //this.label = new St.Label({
        //	text: "Snaps",
        //	y_align: Clutter.ActorAlign.CENTER,
        //});
        this.hbox.add_child(this.icon);
        // here you can add a menu label (step 2/2)
        //this.hbox.add_child(this.label);
        this.hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.add_child(this.hbox);
        
        // remove icon color on click
        this.iconClicked = this.connect('button-press-event', Lang.bind(this, this._removeIconColor));
        
        // initial available snap updates check
        this._refreshIconColor();
		
		// main menu
		menuActions.forEach(this._addSnapMenuItem.bind(this));
		
		// extra actions submenu
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.submenu1 = new PopupMenu.PopupSubMenuMenuItem('Extra actions');
		this.menu.addMenuItem(this.submenu1);
		menuExtraActions.forEach(this._addExtraSubmenuItem.bind(this));
		
		// refresh options submenu
		this.submenu2 = new PopupMenu.PopupSubMenuMenuItem('Refresh options');
		this.menu.addMenuItem(this.submenu2);
		menuRefreshOptions.forEach(this._addRefreshSubmenuItem.bind(this));
		
		// open Snap Store in default browser
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction("Open Snap Store website", event => {
			Util.trySpawnCommandLine("xdg-open https://snapcraft.io/store");
		})
    };
    
    // remove icon color
    _removeIconColor() {
    	this.icon.style = 'color: ;';
    };
    
    // change snap icon color if available updates
    _refreshIconColor() {
    	this.availableRefreshLineCount = ByteArray.toString(GLib.spawn_command_line_sync("bash -c 'snap refresh --list | wc -l'")[1]).slice(0,-1);
        if (this.availableRefreshLineCount == "0") {
        	this.icon.style = 'color: ;';
        } else {
        	this.icon.style = "color: " + REFRESH_ICON_COLOR + ";";
        };
	};
    
    // launch bash command
    _executeAction(command) {
    	try {
    			Util.trySpawnCommandLine("gnome-terminal -x bash -c \"echo Press Ctrl-C to cancel action.; echo; " + command + "; echo; echo --; read -n 1 -s -r -p 'Press any key to close...'\"");
			} catch(err) {
    			Main.notify("Error: unable to execute command in GNOME Terminal");
		};
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
	
	// extra actions submenu items
	_addExtraSubmenuItem(item, index, array) {
	    this.submenu1.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	}
	
	// refresh options submenu items
	_addRefreshSubmenuItem(item, index, array) {
	    this.submenu2.menu.addAction(item[0],event => {
	    	this._executeAction(item[1])
	    });
	}
});

function init() {
}

let _indicator;

function enable() {
    _indicator = new SnapMenu();
    Main.panel.addToStatusArea('snap-menu', _indicator);
}

function disable() {
    _indicator.destroy();
}
