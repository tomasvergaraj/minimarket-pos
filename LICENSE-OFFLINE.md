# Licencia Offline

Flujo recomendado para vender el sistema como producto instalable:

1. Generar un par de claves Ed25519.

```powershell
python scripts/generate_license_keypair.py --private-out secrets/license-private.pem --public-out server-fastapi/license-public.pem
```

2. Configurar la clave publica en el backend.

```env
LICENSE_PUBLIC_KEY_PATH=C:/ruta/a/server-fastapi/license-public.pem
LICENSE_TRIAL_DAYS=30
LICENSE_CLOCK_SKEW_MINUTES=90
```

3. El cliente entra a `Admin > Configuracion > Licencia Offline` y copia el codigo de activacion.

4. Emitir una licencia firmada con tu clave privada.

```powershell
python scripts/issue_license.py `
  --private-key secrets/license-private.pem `
  --request-code "<codigo>" `
  --customer "Minimarket Don Pedro" `
  --max-registers 3 `
  --updates-until 2027-03-13T23:59:59Z `
  --out licenses/don-pedro.json
```

Opciones utiles:

- `--duration-days 365`: licencia con vencimiento.
- `--expires-at 2027-12-31T23:59:59Z`: fecha exacta de expiracion.
- `--feature sii --feature backup`: marcar modulos habilitados.

5. El cliente pega el JSON firmado en la misma pantalla y activa la licencia.

## Estados soportados

- `trial`: prueba activa.
- `trial_expired`: la prueba termino.
- `licensed`: licencia valida.
- `hardware_mismatch`: la base o licencia se movio a otro servidor.
- `clock_tampered`: se detecto retroceso importante del reloj del sistema.
- `license_signature_invalid` y similares: licencia invalida o alterada.

## Notas

- La clave privada nunca debe quedar en el servidor del cliente.
- El bloqueo comercial se aplica en el backend sobre rutas operativas.
- La activacion queda ligada al `installation_id` y al hardware del PC servidor.
