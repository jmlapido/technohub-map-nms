#!/bin/bash

# Stop TechnoHub Network Monitor

echo "Stopping TechnoHub Network Monitor..."

pm2 stop all

echo "✓ Application stopped!"

