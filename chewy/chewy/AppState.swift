//
//  AppState.swift
//  chewy
//

import Foundation
import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var heroStatus: HeroStatus = .idle

    func didAddFood() async {
        heroStatus = .eating

        try? await Task.sleep(nanoseconds: 2_000_000_000)

        heroStatus = .happy

        try? await Task.sleep(nanoseconds: 3_000_000_000)
        if heroStatus == .happy {
            heroStatus = .idle
        }
    }
}
