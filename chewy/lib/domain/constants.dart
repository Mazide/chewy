class PerfectThreshold {
  const PerfectThreshold({
    required this.min,
    required this.max,
  });

  final double min;
  final double max;
}

const double portionWeightS = 1.0;
const double portionWeightM = 1.5;
const double portionWeightL = 2.0;

const PerfectThreshold perfectLife = PerfectThreshold(min: 40, max: 60);
const PerfectThreshold perfectEnergy = PerfectThreshold(min: 17, max: 33);
const PerfectThreshold perfectPower = PerfectThreshold(min: 17, max: 33);

