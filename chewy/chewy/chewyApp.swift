//
//  chewyApp.swift
//  chewy
//
//  Created by Nikita Demidov on 21/02/2026.
//

import SwiftUI

@main
struct chewyApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(appState)
        }
    }
}
