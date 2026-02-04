import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      key: Key('home-screen'),
      child: Text('Home hero screen'),
    );
  }
}

