//
//  AddFoodView.swift
//  chewy
//

import SwiftUI
import AVFoundation

// MARK: - Main View

struct AddFoodView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            // Background — dark purple like reference
            Color(red: 0.22, green: 0.18, blue: 0.28)
                .ignoresSafeArea()

            VStack(spacing: 0) {

                // Drag pill — swipe down to dismiss (native sheet behaviour)
                Capsule()
                    .fill(Color.white.opacity(0.25))
                    .frame(width: 36, height: 5)
                    .padding(.top, 12)
                    .padding(.bottom, 20)

                // ── Scroll banner ─────────────────────────────────────
                // GREYBOX — replace with Image("scroll_banner")
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 0.85, green: 0.72, blue: 0.45))
                        .frame(width: 270, height: 54)
                        .shadow(color: .black.opacity(0.35), radius: 6, y: 4)

                    Text("ANALYZE ESSENCE")
                        .font(.system(size: 17, weight: .black, design: .serif))
                        .foregroundColor(Color(red: 0.22, green: 0.10, blue: 0.02))
                        .tracking(1.5)
                }
                // Uncomment when asset is ready:
                // Image("scroll_banner")
                //     .resizable().scaledToFit().frame(width: 300)

                Spacer()

                // ── Lens + hero ───────────────────────────────────────
                ZStack(alignment: .bottomTrailing) {

                    // Camera inside circle
                    ZStack {
                        CameraView()
                            .frame(width: 260, height: 260)

                        // Glare
                        Ellipse()
                            .fill(.white.opacity(0.12))
                            .frame(width: 80, height: 44)
                            .offset(x: -42, y: -62)
                            .blur(radius: 6)
                    }
                    .clipShape(Circle())
                    .frame(width: 260, height: 260)

                    // Lens rim — GREYBOX, replace with Image("magnifier_lens")
                    Circle()
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    .white.opacity(0.9),
                                    Color(red: 0.5, green: 0.9, blue: 1.0).opacity(0.7),
                                    Color(red: 0.7, green: 0.4, blue: 1.0).opacity(0.6),
                                    .white.opacity(0.5),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 16
                        )
                        .frame(width: 260, height: 260)
                    // Uncomment when asset is ready:
                    // Image("magnifier_lens")
                    //     .resizable().scaledToFit()
                    //     .frame(width: 292, height: 292)

                    // Hero peeking from bottom-right corner
                    SpriteKitHeroView(status: .idle)
                        .frame(width: 80, height: 171)   // ~1/3 width, native aspect
                        .clipped()
                        .offset(x: 28, y: 20)
                }
                // Centre the lens+hero group, give enough room for hero peek
                .frame(width: 292, height: 300)

                Spacer()

                // ── Feed button ───────────────────────────────────────
                Button {
                    dismiss()
                    Task { await appState.didAddFood() }
                } label: {
                    Text("FEED!")
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .background(
                            LinearGradient(
                                colors: [
                                    Color(red: 1.0, green: 0.60, blue: 0.10),
                                    Color(red: 0.85, green: 0.32, blue: 0.05),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                        .shadow(color: Color(red: 0.9, green: 0.35, blue: 0.05).opacity(0.55),
                                radius: 12, x: 0, y: 6)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 28)
                .padding(.bottom, 48)
            }
        }
    }
}

// MARK: - Camera

struct CameraView: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
#if targetEnvironment(simulator)
        let view = UIView()
        view.backgroundColor = UIColor(white: 0.08, alpha: 1)
        let label = UILabel()
        label.text = "📷"
        label.font = .systemFont(ofSize: 52)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        return view
#else
        let view = PreviewView()
        view.startSession()
        return view
#endif
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}

// MARK: - Real camera preview (device only)

#if !targetEnvironment(simulator)
final class PreviewView: UIView {
    private let session = AVCaptureSession()
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    private var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }

    func startSession() {
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.session = session
        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            await self.configureSession()
            self.session.startRunning()
        }
    }

    private func configureSession() async {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        if status == .notDetermined { await AVCaptureDevice.requestAccess(for: .video) }
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { return }
        session.beginConfiguration()
        session.sessionPreset = .photo
        if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
           let input = try? AVCaptureDeviceInput(device: device),
           session.canAddInput(input) { session.addInput(input) }
        session.commitConfiguration()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer.frame = bounds
    }
}
#endif

#Preview {
    AddFoodView()
        .environmentObject(AppState())
}
