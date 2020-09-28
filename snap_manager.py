#!/usr/bin/python3

import subprocess
import sys

version = "1.0"

def b(text):
    # returns bold text
    return "\033[1m" + text + "\033[0m"


def i(text):
    # returns emphasized text
    return "\x1B[3m" + text + "\x1B[23m"


separator = b("*******************************************************************************")


def exit_app():
    # exit application
    sys.exit()


def list_snaps():
    # list all the installed snaps
    print("snap list")
    print(separator)
    subprocess.run(["snap", "list"])
    print(separator)


def recent_changes():
    # list all the recent changes
    print("snap changes")
    print(separator)
    subprocess.run(["snap", "changes"])
    print(separator)


def refresh_snaps():
    # upgrade the snaps
    print("sudo snap refresh")
    print(separator)
    subprocess.run(["sudo", "snap", "refresh"])
    print(separator)


def install_snap():
    # install a given snap
    print(i("Void input to cancel operation"))
    snap = input(b("Snap to be installed: "))
    if snap == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap info", snap)
    print(separator)
    subprocess.run(["snap", "info", snap])
    print(separator)
    print()
    print(i("Void input to cancel operation"))
    channel = input(b("Channel: "))
    if channel == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap install", snap, "--channel=", channel)
    print(separator)
    channel_option = "--channel=" + channel
    subprocess.run(["sudo", "snap", "install", snap, channel_option])
    print(separator)


def remove_snap():
    # remove a given snap
    print(b("List of installed snaps"))
    print(separator)
    subprocess.run(["snap", "list"])
    print(separator)
    print()
    print(i("Void input to cancel operation"))
    snap = input(b("Snap to be REMOVED: "))
    if snap == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap remove", snap)
    print(separator)
    subprocess.run(["sudo", "snap", "remove", snap])
    print(separator)


def snap_info():
    # displays the info of a given snap
    print(i("Void input to cancel operation"))
    snap = input(b("Snap name: "))
    if snap == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap info", snap)
    print(separator)
    subprocess.run(["snap", "info", snap])
    print(separator)


def snap_find():
    # find a snap by search string
    print(i("Void input to cancel operation"))
    snap = input(b("Snap name: "))
    if snap == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap find", snap)
    print(separator)
    subprocess.run(["snap", "find", snap])
    print(separator)


def snap_refresh_channel():
    # change the channel of a given snap
    print(b("List of installed snaps"))
    print(separator)
    subprocess.run(["snap", "list"])
    print(separator)
    print()
    print(i("Void input to cancel operation"))
    snap = input(b("Snap name: "))
    if snap == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    print("snap info", snap)
    print(separator)
    subprocess.run(["snap", "info", snap])
    print(separator)
    print()
    print(i("Void input to cancel operation"))
    channel = input(b("New channel: "))
    if channel == "":
        print()
        print(b("Operation cancelled"))
        return
    print()
    channel_option = "--channel=" + channel
    print("sudo snap refresh", snap, channel_option)
    print(separator)
    subprocess.run(["sudo", "snap", "refresh", snap, channel_option])
    print(separator)


def main_menu_items():
    # available actions in main menu: [label, action]
    items_list = [
        ["Exit", exit_app],
        ["List installed snaps", list_snaps],
        ["Recent changes", recent_changes],
        ["Refresh snaps", refresh_snaps],
        ["Install a snap", install_snap],
        ["Remove a snap", remove_snap],
        ["Display info about a snap", snap_info],
        ["Find a snap", snap_find],
        ["Change a snap channel", snap_refresh_channel]
        ]
    return items_list
        

def main_menu():
    # main menu 
    items_list = main_menu_items()
    items_length = len(items_list)
    # display main menu
    print()
    print(b("MENU"))
    for k in range(items_length):
        print(k, " ", items_list[k][0])
    print()
    # ask what to do
    action_number = -1
    try:
        action_number = int(input(b("Choice: ")))
    except ValueError:
        print(b("Invalid input"))
        main_menu()
    if action_number in range(items_length):
        print(b(items_list[action_number][0]))
    else:
        print(b("Invalid input"))
        main_menu()
    print()
    # just do it
    items_list[action_number][1]()
    print()


def main():
    print()
    print(b("SNAP MANAGER - (c) Francois Thirioux"))
    print("v.", version)
    while True:
        main_menu()


main()



