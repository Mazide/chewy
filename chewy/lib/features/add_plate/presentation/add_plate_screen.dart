import 'package:flutter/material.dart';

class AddPlateScreen extends StatelessWidget {
  const AddPlateScreen({super.key});

  static const String routeName = '/add-plate';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add Plate')),
      body: const Center(
        key: Key('add-plate-screen'),
        child: Text('Add Plate placeholder'),
      ),
    );
  }
}

