/*	Snap Manager
	Unofficial snap manager for usual snap tasks
	GNOME Shell extension
	(c) Francois Thirioux 2020
	License: GPLv3 */
	

const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Util = imports.misc.util;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// here you can add/remove/hack the actions
var menuActions =	[	
						["List snap updates", "echo List snap updates; echo; snap refresh --list"],
						["List installed snaps", "echo List installed snaps; echo; snap list"],
						["Recent snap changes", "echo Recent snap changes; echo; snap changes"],
						["Refresh installed snaps", "echo Refresh installed snaps; echo; snap refresh"],
						["Install snap...", "echo Install snap...; echo; read -p 'Enter snap name: ' snapname; read -p 'Enter channel (void=default): ' snapchannel; echo; snap install $snapname --channel=$snapchannel"],
						["Remove snap...", "echo Remove snap...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; echo; snap remove $snapname"]
					];

// here you can add/remove/hack the extra actions					
var menuExtraActions = 	[
							["Change snap channel...", "echo Change snap channel...; echo; snap list; echo; read -p 'Enter snap name: ' snapname; read -p 'Enter channel: ' snapchannel; echo; snap refresh $snapname --channel=$snapchannel"],
							["Snap info...", "echo Snap info...; echo; read -p 'Enter snap name: ' snapname; echo; snap info $snapname"],
							["Find snap...", "echo Find snap...; echo; read -p 'Enter one word to search: ' snapsearch; echo; snap find $snapsearch"],
							["Hold auto refresh for one hour", "echo Hold auto refresh for one hour; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 hour')"],
							["Hold auto refresh for one day", "echo Hold auto refresh for one day; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 day')"],
							["Hold auto refresh for one week", "echo Hold auto refresh for one week; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 week')"]
						];

let SnapMenu = GObject.registerClass(
class SnapMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Snap manager');

        let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        let icon = new St.Icon({
        	// here you can change the menu icon
            icon_name: 'applications-system-symbolic',
            style_class: 'system-status-icon',
        });
        // here you can remove the menu label (step 1/2)
        let label = new St.Label({
        	text: "Snaps",
        	y_align: Clutter.ActorAlign.CENTER,
        });

        hbox.add_child(icon);
        // here you can remove the menu label (step 2/2)
        hbox.add_child(label);
        hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.add_child(hbox);
		
		// main actions
		menuActions.forEach(this._addSnapMenuItem.bind(this));
		
		// extra actions
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.submenu = new PopupMenu.PopupSubMenuMenuItem('Extra actions');
		this.menu.addMenuItem(this.submenu);
		menuExtraActions.forEach(this._addSnapSubmenuItem.bind(this));
		
		// open Snap Store in default browser
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction("Open Snap Store website", event => {
			Util.trySpawnCommandLine("xdg-open https://snapcraft.io/store");
		})
    }
    
    _addSnapMenuItem(item, index, array) {
    	if (index == 3) {
	    		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    }
	    this.menu.addAction(item[0],event => {
	    	try {
    			Util.trySpawnCommandLine("gnome-terminal -x bash -c \"" + item[1] + "; echo; echo ---------------------------; read -n 1 -s -r -p 'Press any key to close...'\"");
			} catch(err) {
    			Main.notify("Error: unable to execute command in GNOME Terminal");
			}
	    });
	}
	
	_addSnapSubmenuItem(item, index, array) {
	    this.submenu.menu.addAction(item[0],event => {
	    	try {
    			Util.trySpawnCommandLine("gnome-terminal -x bash -c \"" + item[1] + "; echo; echo ---------------------------; read -n 1 -s -r -p 'Press any key to close...'\"");
			} catch(err) {
    			Main.notify("Error: unable to execute command in GNOME Terminal");
			}
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
