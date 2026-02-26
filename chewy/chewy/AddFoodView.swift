//
//  AddFoodView.swift
//  chewy
//

import SwiftUI
import AVFoundation
import PhotosUI

// MARK: - Main View

struct AddFoodView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var captureRequested = false
    @State private var photosPickerItem: PhotosPickerItem?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {

                // ── Camera + label ────────────────────────────────────────
                ZStack(alignment: .top) {
                    CameraView(captureRequested: $captureRequested) { image in
                        Task { await appState.didAddFood(image: image) }
                        dismiss()
                    }
                    .ignoresSafeArea(edges: .top)

                    // GREYBOX label — replace with scroll banner asset
                    Text("ANALYZE ESSENCE")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.gray.opacity(0.7))
                        .cornerRadius(8)
                        .padding(.top, 16)
                }

                // ── Toolbar ───────────────────────────────────────────────
                HStack(spacing: 16) {
                    Spacer()

                    // GREYBOX button — gallery picker
                    PhotosPicker(selection: $photosPickerItem, matching: .images) {
                        Text("Gallery")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 90, height: 50)
                            .background(Color.gray.opacity(0.5))
                            .cornerRadius(10)
                    }
                    .onChange(of: photosPickerItem) { _, item in
                        guard let item else { return }
                        Task {
                            if let data = try? await item.loadTransferable(type: Data.self),
                               let image = UIImage(data: data) {
                                await appState.didAddFood(image: image)
                                dismiss()
                            }
                        }
                    }

                    // GREYBOX button — replace with FEED! rune button
                    Button {
                        captureRequested = true
                    } label: {
                        Text(appState.isAnalyzing ? "..." : "FEED!")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 120, height: 50)
                            .background(Color.gray.opacity(appState.isAnalyzing ? 0.3 : 0.6))
                            .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                    .disabled(appState.isAnalyzing)

                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color(white: 0.15))
            }
        }
    }
}

// MARK: - Camera

struct CameraView: UIViewRepresentable {
    @Binding var captureRequested: Bool
    var onCapture: (UIImage) -> Void

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIView {
#if targetEnvironment(simulator)
        let view = SimulatorCameraPlaceholder()
        context.coordinator.simulatorView = view
        return view
#else
        let view = PreviewView()
        view.startSession()
        context.coordinator.previewView = view
        return view
#endif
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        guard captureRequested else { return }
        let binding = _captureRequested
        context.coordinator.capture(completion: onCapture) {
            DispatchQueue.main.async { binding.wrappedValue = false }
        }
    }

    final class Coordinator: NSObject {
        private var isCapturing = false

#if targetEnvironment(simulator)
        var simulatorView: SimulatorCameraPlaceholder?
#else
        var previewView: PreviewView?
#endif

        func capture(completion: @escaping (UIImage) -> Void, done: @escaping () -> Void) {
            guard !isCapturing else { done(); return }
            isCapturing = true
#if targetEnvironment(simulator)
            let image = simulatorView?.placeholderImage() ?? UIImage(systemName: "fork.knife")!
            completion(image)
            isCapturing = false
            done()
#else
            previewView?.capturePhoto { [weak self] image in
                self?.isCapturing = false
                completion(image)
                done()
            }
#endif
        }
    }
}

// MARK: - Simulator placeholder

#if targetEnvironment(simulator)
final class SimulatorCameraPlaceholder: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func setup() {
        backgroundColor = UIColor(red: 0.10, green: 0.09, blue: 0.08, alpha: 1)

        let gradient = CAGradientLayer()
        gradient.colors = [
            UIColor(red: 0.20, green: 0.16, blue: 0.12, alpha: 1).cgColor,
            UIColor(red: 0.08, green: 0.07, blue: 0.06, alpha: 1).cgColor,
        ]
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint   = CGPoint(x: 0.5, y: 1)
        gradient.name = "bg"
        layer.insertSublayer(gradient, at: 0)

        let iv: UIImageView
        if let asset = UIImage(named: "camera_placeholder") {
            iv = UIImageView(image: asset)
            iv.contentMode = .scaleAspectFill
        } else {
            let config = UIImage.SymbolConfiguration(pointSize: 72, weight: .ultraLight)
            iv = UIImageView(image: UIImage(systemName: "fork.knife.circle", withConfiguration: config))
            iv.tintColor = UIColor.white.withAlphaComponent(0.18)
            iv.contentMode = .scaleAspectFit
        }
        iv.clipsToBounds = true
        iv.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iv)

        NSLayoutConstraint.activate([
            iv.topAnchor.constraint(equalTo: topAnchor),
            iv.bottomAnchor.constraint(equalTo: bottomAnchor),
            iv.leadingAnchor.constraint(equalTo: leadingAnchor),
            iv.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.sublayers?.first(where: { $0.name == "bg" })?.frame = bounds
    }

    // Returns placeholder image for simulator capture simulation
    func placeholderImage() -> UIImage? {
        UIImage(named: "camera_placeholder")
    }
}
#endif

// MARK: - Real camera preview (device only)

#if !targetEnvironment(simulator)
final class PreviewView: UIView, AVCapturePhotoCaptureDelegate {
    private let session     = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private var captureCompletion: ((UIImage) -> Void)?

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
        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
        session.commitConfiguration()
    }

    func capturePhoto(completion: @escaping (UIImage) -> Void) {
        captureCompletion = completion
        photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data) else { return }
        captureCompletion?(image)
        captureCompletion = nil
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
