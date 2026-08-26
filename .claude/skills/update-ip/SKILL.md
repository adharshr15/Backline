---
name: update-ip
description: Update the backend BASE_URL in the frontend to the machine's current Wi-Fi IPv4 address. Use when the user says their IP changed, the app can't reach the backend, or asks to "update the IP".
---

# Update IP Address

Updates `BASE_URL` in `frontend/backline/services/api.ts` to the machine's current Wi-Fi IPv4 address so the Expo app can reach the local backend.

## Steps

1. Get the current Wi-Fi IPv4 address. On Windows, run:
   ```
   ipconfig
   ```
   Find the `Wireless LAN adapter Wi-Fi:` block and read its `IPv4 Address`.
   Ignore virtual adapters (e.g. `vEthernet (WSL...)`, Hyper-V) — those are NOT the address to use.

2. Read the current value in `frontend/backline/services/api.ts`:
   ```
   export const BASE_URL = "http://<OLD_IP>:3000"
   ```

3. Replace `<OLD_IP>` with the Wi-Fi IPv4 from step 1, keeping the `http://` prefix and `:3000` port.

4. Confirm the new value back to the user, e.g. `BASE_URL is now http://192.168.1.114:3000`.

## Notes
- The port is always `3000` unless the user says otherwise.
- Only the Wi-Fi adapter address is correct for a physical phone on the same network. `localhost`/`127.0.0.1` will not work from a phone.
