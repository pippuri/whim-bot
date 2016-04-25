#!/bin/sh
# Create a set of simulation users in the development environment
# Simulation users have phone number prefix +292 (unallocated code)
for ((i = 10000; i <= 10009; i++)); do
  phone="+292$i"
  echo "Registering simulation user $phone"
  curl "https://api.dev.maas.global/auth/sms-login?code=292&phone=$phone"
done
