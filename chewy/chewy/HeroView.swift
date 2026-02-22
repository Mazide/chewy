//
//  HeroView.swift
//  chewy
//
//  SPRITE INTEGRATION POINT:
//  Этот компонент — единственное место, где живёт визуализация героя.
//  Когда будешь добавлять спрайтовую анимацию:
//
//  1. Вариант A — SpriteKit:
//     Замени тело `HeroSpriteView` на SpriteView(scene: yourScene).
//     `HeroStatus` передаётся снаружи — используй его чтобы переключать
//     анимационные состояния (idle / eating / happy) внутри SKScene.
//
//  2. Вариант B — покадровая анимация (Image atlas):
//     Замени Circle+Text на TimelineView или кастомный AnimatedImage,
//     переключая кадры по таймеру в зависимости от `status`.
//
//  Внешний интерфейс (input: HeroStatus) не меняется в обоих случаях.
//

import SwiftUI

// MARK: - Public component — используется в HomeView

struct HeroView: View {
    let status: HeroStatus

    var body: some View {
        ZStack {
            // Контейнер-карточка
            RoundedRectangle(cornerRadius: 28)
                .fill(Color.white.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 28)
                        .strokeBorder(Color.white.opacity(0.4), lineWidth: 2)
                )

            VStack(spacing: 16) {
                // Статус-бейдж
                StatusBadge(status: status)

                // ── SPRITE ZONE ──────────────────────────────────────────
                SpriteKitHeroView(status: status)
                // ─────────────────────────────────────────────────────────

                // Речевой пузырь
                SpeechBubble(status: status)

                // Прогресс-индикатор во время анализа
                if status == .eating {
                    ProgressView()
                        .tint(.white)
                }
            }
            .padding(20)
        }
    }
}

// MARK: - Sprite placeholder
// Всё что внутри этого View — заменяемая заглушка

private struct HeroSpriteView: View {
    let status: HeroStatus

    private var color: Color {
        switch status {
        case .hungry: return Color(red: 0.6, green: 0.6, blue: 0.7)
        case .eating: return Color(red: 0.9, green: 0.7, blue: 0.2)
        case .happy:  return Color(red: 0.2, green: 0.85, blue: 0.5)
        }
    }

    private var emoji: String {
        switch status {
        case .hungry: return "🤖"
        case .eating: return "😋"
        case .happy:  return "😄"
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.3))
                .frame(width: 120, height: 120)
            Circle()
                .strokeBorder(color, lineWidth: 3)
                .frame(width: 120, height: 120)
            Text(emoji)
                .font(.system(size: 72))
        }
        // Пульсация во время анализа
        .scaleEffect(status == .eating ? 1.08 : 1.0)
        .animation(
            status == .eating
                ? .easeInOut(duration: 0.6).repeatForever(autoreverses: true)
                : .default,
            value: status
        )
    }
}

// MARK: - Status Badge

private struct StatusBadge: View {
    let status: HeroStatus

    private var color: Color {
        switch status {
        case .hungry: return Color(red: 0.6, green: 0.6, blue: 0.7)
        case .eating: return Color(red: 0.9, green: 0.7, blue: 0.2)
        case .happy:  return Color(red: 0.2, green: 0.85, blue: 0.5)
        }
    }

    var body: some View {
        Text(status.rawValue.uppercased())
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(color.opacity(0.8))
            .clipShape(Capsule())
    }
}

// MARK: - Speech Bubble

private struct SpeechBubble: View {
    let status: HeroStatus

    private var text: String {
        switch status {
        case .hungry: return "I'm hungry..."
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
            .transition(.opacity.combined(with: .scale))
            .id(status) // форсирует transition при смене статуса
    }
}

#Preview("Hungry") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .hungry).frame(height: 260).padding()
    }
}

#Preview("Eating") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .eating).frame(height: 260).padding()
    }
}

#Preview("Happy") {
    ZStack {
        Color(red: 0.2, green: 0.6, blue: 0.3).ignoresSafeArea()
        HeroView(status: .happy).frame(height: 260).padding()
    }
}
