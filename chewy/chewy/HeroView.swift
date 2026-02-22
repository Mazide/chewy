//
//  HeroView.swift
//  chewy
//

import SwiftUI

struct HeroView: View {
    let status: HeroStatus

    var body: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .bottom) {
                // ── SPRITE ZONE ───────────────────────────────────────────
                SpriteKitHeroView(status: status)
                // ─────────────────────────────────────────────────────────

                // Contact shadow — ellipse at feet
                Ellipse()
                    .fill(
                        RadialGradient(
                            colors: [.black.opacity(0.35), .clear],
                            center: .center,
                            startRadius: 0,
                            endRadius: 60
                        )
                    )
                    .frame(width: 120, height: 24)
                    .offset(y: 12)
                    .blur(radius: 6)
            }

            SpeechBubble(status: status)
        }
    }
}

// MARK: - Speech Bubble

private struct SpeechBubble: View {
    let status: HeroStatus

    private var text: String {
        switch status {
        case .idle:   return "I'm hungry..."
        case .eating: return "Analysing your meal..."
        case .happy:  return "That was delicious!"
        }
    }

    var body: some View {
        Text(text)
            .font(.system(size: 15, weight: .semibold, design: .rounded))
            .foregroundColor(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .transition(.opacity.combined(with: .scale))
            .id(status)
    }
}

#Preview("Idle") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .idle).frame(height: 400).padding()
    }
}

#Preview("Eating") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .eating).frame(height: 400).padding()
    }
}

#Preview("Happy") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .happy).frame(height: 400).padding()
    }
}
