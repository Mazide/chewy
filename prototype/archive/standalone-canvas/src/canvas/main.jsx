import React from 'react';
import { createRoot } from 'react-dom/client';
import { CampCanvas } from '../core/CampCanvas.jsx';
import './page.css';

createRoot(document.getElementById('root')).render(<CampCanvas />);
