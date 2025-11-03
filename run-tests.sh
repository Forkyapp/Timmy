#!/bin/bash

echo "Installing dependencies..."
npm install --silent

echo ""
echo "Running tests..."
npm test
