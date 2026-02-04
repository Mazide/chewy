import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/add_plate/presentation/add_plate_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import 'app_shell.dart';
import 'app_theme.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Chewy',
      theme: AppTheme.light,
      home: const AppShell(),
      routes: {
        AddPlateScreen.routeName: (_) => const AddPlateScreen(),
        SettingsScreen.routeName: (_) => const SettingsScreen(),
      },
    );
  }
}

