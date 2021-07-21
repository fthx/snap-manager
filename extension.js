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

const GET_TEXT_DOMAIN = 'snap-manager-indicator';
const Gettext = imports.gettext;

const _ = Gettext.domain(GET_TEXT_DOMAIN).gettext;

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
			
			this._buildMenu();
		}

		_buildMenu() {
			// main menu
			this.menu.addAction(_("List installed snaps"), () => this._executeAction(`echo ${_('List installed snaps')}; echo; snap list`));
			this.menu.addAction(_("List recent snap changes"), () => this._executeAction(`echo ${_('List recent snap changes')}; echo; snap changes`));
			this.menu.addAction(_("List available snap refresh"), () => this._executeAction(`echo ${_('List available snap refresh')}; echo; snap refresh --list`));

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			this.menu.addAction(_("Refresh installed snaps"), () => this._executeAction(`echo ${_('Refresh installed snaps')}; echo; snap refresh`));
			this.menu.addAction(_("Install snap..."), () => this._executeAction(`echo ${_('Install snap...')}; echo; read -p '${_('Enter snap name')}: ' snapname; echo; echo '${_('Available channels')}:'; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p '${_('Enter channel')} (void=default): ' snapchannel; echo; snap install $snapname --channel=$snapchannel`));
			this.menu.addAction(_("Remove snap..."), () => this._executeAction(`echo ${_('Remove snap...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; snap remove $snapname`));
			
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			// snap configuration submenu
			this.submenu1 = new PopupMenu.PopupSubMenuMenuItem(_('Snap options'));
			this.menu.addMenuItem(this.submenu1);
			
			this.submenu1.menu.addAction(_("Snap info..."), () => this._executeAction(`echo ${_('Snap info...')}; echo; read -p '${_('Enter snap name')}: ' snapname; echo; snap info --verbose $snapname`));
			this.submenu1.menu.addAction(_("Refresh snap channel..."), () => this._executeAction(`echo ${_('Refresh snap channel')}...; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; echo ${_('Available channels')}:; snap info $snapname | awk '/channels:/{y=1;next}y'; echo; read -p '${_('Enter new channel')}: ' snapchannel; echo; snap refresh $snapname --channel=$snapchannel`));
			this.submenu1.menu.addAction(_("Revert snap refresh..."), () => this._executeAction(`echo ${_('Revert snap refresh...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; snap revert $snapname`));
			this.submenu1.menu.addAction(_("Enable snap..."), () => this._executeAction(`echo ${_('Enable snap...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; snap enable $snapname`));
			this.submenu1.menu.addAction(_("Disable snap..."), () => this._executeAction(`echo ${_('Disable snap...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; snap disable $snapname`));

			// snap connections submenu
			this.submenu2 = new PopupMenu.PopupSubMenuMenuItem(_('Snap connections'));
			this.menu.addMenuItem(this.submenu2);

			this.submenu2.menu.addAction(_("List available interfaces"), () => this._executeAction(`echo ${_('List available interfaces')}; echo; snap interface`));
			this.submenu2.menu.addAction(_("List snap connections..."), () => this._executeAction(`echo ${_('List snap connections...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; echo ${_('Available connections')}:; snap connections $snapname`));
			this.submenu2.menu.addAction(_("Connect snap..."), () => this._executeAction(`echo ${_('Connect snap...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; echo ${_('Available connections')}:; snap connections $snapname; echo; read -p '${_('Enter interface to connect')}: ' snapconnection; echo; snap connect $snapname:$snapconnection`));
			this.submenu2.menu.addAction(_("Disconnect snap..."), () => this._executeAction(`echo ${_('Disconnect snap...')}; echo; snap list; echo; read -p '${_('Enter snap name')}: ' snapname; echo; echo ${_('Available connections')}:; snap connections $snapname; echo; read -p '${_('Enter interface to disconnect')}: ' snapconnection; echo; snap disconnect $snapname:$snapconnection`));

			// refresh options submenu
			this.submenu3 = new PopupMenu.PopupSubMenuMenuItem(_('Refresh options'));
			this.menu.addMenuItem(this.submenu3);

			this.submenu3.menu.addAction(_("Refresh schedule"), () => this._executeAction(`echo ${_('Refresh schedule')}; echo; snap refresh --time`));
			this.submenu3.menu.addAction(_("Hold auto refresh for one hour"), () => this._executeAction(`echo ${_('Hold auto refresh for one hour')}; echo; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 hour'); echo; echo ${_('Refresh schedule')}; echo; snap refresh --time | grep hold`));
			this.submenu3.menu.addAction(_("Hold auto refresh for one day"), () => this._executeAction(`echo ${_('Hold auto refresh for one day')}; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 day'); echo; echo ${_('Refresh schedule')}; echo; snap refresh --time | grep hold`));
			this.submenu3.menu.addAction(_("Hold auto refresh for one week"), () => this._executeAction(`echo ${_('Hold auto refresh for one week')}; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 week'); echo; echo ${_('Refresh schedule')}; echo; snap refresh --time | grep hold`));
			this.submenu3.menu.addAction(_("Hold auto refresh for one month"), () => this._executeAction(`echo ${_('Hold auto refresh for one month')}; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '1 month'); echo; echo ${_('Refresh schedule')}; echo; snap refresh --time | grep hold`));
			this.submenu3.menu.addAction(_("Cancel hold auto refresh"), () => this._executeAction(`echo ${_('Cancel auto refresh delay')}; echo; sudo snap set system refresh.hold=$(date --iso-8601=seconds -d '0 second'); echo; echo ${_('Refresh schedule')}; echo; snap refresh --time`));

			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			
			// run Snap Store snap app
			this.menu.addAction(_("Run Snap Store application"), _ => {
				Util.trySpawnCommandLine("snap-store");
			});
			
			// open Snap Store in default browser
			this.menu.addAction(_("Open Snap Store website"), _ => {
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
					this.refreshTime = _("Auto updates disabled, reactivation") + this.refreshTime;
				} else {
					this.file = Gio.File.new_for_path(refreshFileNext);
					this.fileContent = this.file.load_contents(null)[1];
					this.refreshNext = ByteArray.toString(this.fileContent).slice(0,-1).split('next:')[1].split(',')[0];
					this.refreshTime = _("Auto updates enabled, next") + this.refreshNext;
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
				this.notificationTitle = _("Snap Manager");
				switch (this.refreshCounter) {
					case -1:
						this.notificationMessage = `${_('No snap refresh available')}\n\n` + this.refreshTime;
						this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
						break;
					case 1:
						this.notificationMessage = `${_('Refresh available, 1 snap needs to be updated')}:\n` + this.refreshNames + "\n\n" + this.refreshTime;
						this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
						this.notification.addAction(_("Refresh now"), this._snapRefresh.bind(this));
						break;
					default:
						this.notificationMessage = `${_('Refresh available')}, ` + this.refreshCounter + ` ${_('snaps need to be updated')}:\n` + this.refreshNames + "\n\n" + this.refreshTime;
						this.notification = new MessageTray.Notification(this.notificationSource, this.notificationTitle, this.notificationMessage);
						this.notification.addAction(_("Refresh now"), this._snapRefresh.bind(this));
				}
				this.notification.urgency = Urgency.CRITICAL;
				this.notification.addAction(_("Recent changes"), this._snapChanges.bind(this));
				this.notificationSource.showNotification(this.notification);
			});
		};
		
		// launch bash command
		_executeAction(command) {
			try {
				Util.trySpawnCommandLine(`gnome-terminal -x bash -c \"echo ${_('Press Ctrl-C to cancel action.')}; echo;  ${command} ; echo; echo --; read -n 1 -s -r -p '${_('Press any key to close...')}'\"`);
			} catch(err) {
				Main.notify(_("Error: unable to execute command in GNOME Terminal"));
			}
		}
		
		// snap refresh direct shortcut
		_snapRefresh() {
			this._executeAction(`echo ${_('Refresh installed snaps')}; echo; snap refresh`);
			this.notification.destroy();
		}
		
		// snap changes direct shortcut
		_snapChanges() {
			this._executeAction(`echo ${_('List recent snap changes')}; echo; snap changes`);
			this.notification.destroy();
		};
		
		_destroy() {
			if (this.refreshTimeout) {
				GLib.source_remove(this.refreshTimeout);
			}
			if (this.waitRefreshTimeout) {
				GLib.source_remove(this.waitRefreshTimeout);
			}
			super.destroy();
		}	
	}
);

class Extension {
	constructor() {
		Gettext.bindtextdomain(GET_TEXT_DOMAIN, Me.dir.get_child('locale').get_path());
		Gettext.textdomain(GET_TEXT_DOMAIN);
	}

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
