//
//  AddFoodView.swift
//  chewy
//

import SwiftUI

struct AddFoodView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var portionSize: Double = 50.0

    var body: some View {
        ZStack {
            Color(red: 0.12, green: 0.12, blue: 0.18)
                .ignoresSafeArea()

            VStack(spacing: 0) {

                // MARK: - Nav bar
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.15))
                            .clipShape(Circle())
                    }

                    Spacer()

                    Text("Scan Food")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    Spacer()

                    // balance xmark
                    Color.clear.frame(width: 36, height: 36)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 12)

                // MARK: - Mock Camera View
                // Изолированный контейнер — сюда позже вставить реальную камеру или SpriteKit сцену
                MockCameraView()
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                // MARK: - Portion Slider
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Portion Size")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Spacer()
                        Text("\(Int(portionSize))%")
                            .font(.system(size: 16, weight: .heavy, design: .rounded))
                            .foregroundColor(sliderColor)
                            .animation(.easeInOut, value: portionSize)
                    }

                    Slider(value: $portionSize, in: 0...100, step: 1)
                        .tint(sliderColor)
                        .animation(.easeInOut, value: portionSize)

                    // Labels под слайдером
                    HStack {
                        Text("Small")
                        Spacer()
                        Text("Medium")
                        Spacer()
                        Text("Large")
                    }
                    .font(.system(size: 11, design: .rounded))
                    .foregroundColor(.white.opacity(0.4))
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)

                Spacer()

                // MARK: - Feed Button
                Button {
                    dismiss()
                    // Запускаем async логику после возврата на Home
                    Task {
                        await appState.feedHero(portionSize: portionSize)
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 18, weight: .bold))
                        Text("Feed!")
                            .font(.system(size: 20, weight: .black, design: .rounded))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 1.0, green: 0.55, blue: 0.1), Color(red: 0.9, green: 0.3, blue: 0.1)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .shadow(color: Color(red: 0.9, green: 0.3, blue: 0.1).opacity(0.5), radius: 12, x: 0, y: 6)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
    }

    private var sliderColor: Color {
        switch portionSize {
        case 0..<34:  return Color(red: 0.3, green: 0.85, blue: 0.5)
        case 34..<67: return Color(red: 1.0, green: 0.8, blue: 0.1)
        default:      return Color(red: 1.0, green: 0.35, blue: 0.2)
        }
    }
}

// MARK: - Mock Camera View
//
// Этот компонент — заглушка для камеры.
// Когда будешь добавлять реальную камеру или AR сцену —
// просто замени содержимое этого View, интерфейс не изменится.

struct MockCameraView: View {
    @State private var scanPhase: Bool = false

    var body: some View {
        ZStack {
            // Фон — имитация viewfinder
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(red: 0.08, green: 0.08, blue: 0.12))

            // Уголки сканера
            ScannerCorners()
                .stroke(Color(red: 0.3, green: 0.9, blue: 0.6), lineWidth: 3)
                .padding(20)

            // Сканирующая линия
            VStack {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.clear, Color(red: 0.3, green: 0.9, blue: 0.6).opacity(0.8), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(height: 2)
                    .padding(.horizontal, 40)
                    .offset(y: scanPhase ? 120 : -120)
                    .animation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true), value: scanPhase)
            }

            // Плейсхолдер текст
            VStack(spacing: 8) {
                Spacer()
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 36))
                    .foregroundColor(.white.opacity(0.2))
                Text("Point camera at your food")
                    .font(.system(size: 13, design: .rounded))
                    .foregroundColor(.white.opacity(0.3))
                Spacer()
            }
        }
        .frame(height: 260)
        .onAppear { scanPhase = true }
    }
}

// MARK: - Scanner Corner Shape
// Рисует 4 угловых уголка как у сканера

struct ScannerCorners: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let len: CGFloat = 24
        let r: CGFloat = 8

        // Top-left
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + len))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
        path.addQuadCurve(to: CGPoint(x: rect.minX + r, y: rect.minY), control: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX + len, y: rect.minY))

        // Top-right
        path.move(to: CGPoint(x: rect.maxX - len, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + r), control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY + len))

        // Bottom-right
        path.move(to: CGPoint(x: rect.maxX, y: rect.maxY - len))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - r))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - r, y: rect.maxY), control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX - len, y: rect.maxY))

        // Bottom-left
        path.move(to: CGPoint(x: rect.minX + len, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + r, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - r), control: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY - len))

        return path
    }
}

#Preview {
    AddFoodView()
        .environmentObject(AppState())
}
