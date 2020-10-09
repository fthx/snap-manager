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
var menuActions = 	[	
						["Refresh installed snaps", "echo Refresh installed snaps; echo; snap refresh"],
						["List installed snaps", "echo List installed snaps; echo; snap list"],
						["Recent snap changes", "echo Recent snap changes; echo; snap changes"],
						["Install snap...", "echo Install snap...; echo; echo -e Enter snap name:; read snapname; echo Enter channel:; read snapchannel; echo; snap install $snapname --channel=$snapchannel"],
						["Remove snap...", "echo Remove snap...; echo; echo -e Enter snap name:; read snapname; echo; snap remove $snapname"],
						["Change snap channel...", "echo Change snap channel...; echo; echo -e Enter snap name:; read snapname; echo Enter channel:; read snapchannel; echo; snap refresh $snapname --channel=$snapchannel"],
						["Snap info...", "echo Snap info...; echo; echo -e Enter snap name:; read snapname; echo; snap info $snapname"],
						["Find snap...", "echo Find snap...; echo; echo -e Enter one search word:; read snapsearch; echo; snap find $snapsearch"],
						["Open Snap Store website", "xdg-open https://snapcraft.io/store"],
						
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

		menuActions.forEach(this._addSnapMenuItem.bind(this));
    }
    
    _addSnapMenuItem(item, index, array) {
    	if (index == 3 || index == 6 || index == 8) {
    		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    	}
	    this.menu.addAction(item[0],event => {
	    	try {
    			Util.trySpawnCommandLine("gnome-terminal -x bash -c '" + item[1] + "; echo; echo -----------------------; echo Press enter to close...; read line'");
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
