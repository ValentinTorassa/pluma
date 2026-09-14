Pasa así: armás un proyecto chico, ponés la API key en un :key[.env], te olvidás del `.gitignore` y hacés `git push`. Diez minutos después te das cuenta, borrás el archivo, commit, push. En la pestaña de GitHub el :key[.env] ya no está.

Y sin embargo la key sigue ahí. No es un bug de GitHub ni mala suerte: es cómo funciona Git. Este artículo es sobre esos minutos y sobre qué hacer, en orden.

## El archivo que borraste

Git no guarda archivos sueltos: guarda una foto del proyecto entero en cada commit. Cuando borrás el :key[.env], creás una foto nueva sin el archivo. Las anteriores siguen existiendo, y la pestaña de GitHub te muestra solo la última, :head[HEAD].

Fijate en qué fotos queda el :key[.env]. Con las flechas podés volver al primer commit, y el último paso muestra qué se lleva alguien que clona el repo.

::figure{name="git-history" caption="Repo de ejemplo. Cada tarjeta es la foto que guarda un commit."}

Un clone trae todas las fotos, no solo la última. Cualquiera puede buscar el archivo en el historial y leerlo:

```bash
$ git log --all --oneline -- .env
e05d2a8 borro el .env
7c2e4b1 conecto la API
$ git show 7c2e4b1:.env
OPENAI_API_KEY=sk-proj-7Hq2…
```

:::aside
*Pasarlo a privado tampoco alcanza.* Los forks y los clones que ya existen tienen su copia, y no dependen de tu configuración.
:::

## Quién mira un push público

Un repo público no es público solo para personas. Hay :scan[scanners] que leen el feed de eventos públicos de GitHub y buscan cadenas con forma conocida: `AKIA` en las keys de AWS, `ghp_` en los tokens de GitHub, `sk-` en varios proveedores de IA. No necesitan entrar a tu repo: les llega el diff.

La pregunta útil no es si alguien la vio. Es cuánto tiempo pasó entre el push y el momento en que :you[vos] te diste cuenta: esa es la :exp[ventana de exposición]. Mové tu marca y mirá qué alcanzó a pasar.

::figure{name="scanner-race" caption="Tiempos ilustrativos. Varían según el tipo de secreto."}

Del otro lado, GitHub tiene *secret scanning*: para algunos proveedores le avisa al emisor de la key, que puede revocarla sola. Para otros no pasa nada. Por eso lo que importa es qué podía hacer esa key.

| Secreto | Forma | Avisa GitHub | Qué hacer primero |
| --- | --- | --- | --- |
| Access key de AWS | `AKIA…` | sí | Desactivarla en IAM y mirar CloudTrail |
| Token de GitHub | `ghp_…` | sí | Revocarlo y generar otro con scopes mínimos |
| Key de IA | `sk-…` | depende | Revocarla y poner límite de gasto |
| Contraseña de la base | ninguna | no | Cambiarla y revisar conexiones |

## Rotar antes que limpiar

El instinto es reescribir el historial para que no quede rastro. Para mí ese es el error más común: se siente como arreglarlo, y no lo es. Mientras reescribís, la key sigue siendo válida en cada copia que ya existe, y ninguna reescritura llega hasta ahí.

Probá los dos órdenes. La key vive en el proveedor; las líneas rojas son las copias que todavía pueden usarla. :safe[Rotar] la mata en todas a la vez.

::figure{name="rotate-vs-clean" caption="Los minutos son un ejemplo: reescribir, forzar el push y avisarle al equipo lleva su rato."}

1. Revocar o rotar la key en el proveedor. Antes que cualquier otra cosa.
2. Revisar el uso desde el momento del push: facturación, CloudTrail, el panel que tenga el proveedor.
3. Sacar el archivo del historial, recién ahora.
4. Frenar el próximo push antes de que salga de tu máquina.

## Sacarlo del historial

Para reescribir uso `git filter-repo`, que reemplazó a `filter-branch`. Cambia el hash de cada commit desde el que tocó el archivo, así que cualquiera que trabaje en el repo va a tener que volver a clonar.

```bash
# primero: ¿en qué commits está?
git log --all --full-history --oneline -- .env

# después de rotar la key, recién ahí
git filter-repo --invert-paths --path .env
git push --force --all
```

:::aside
*Una aclaración.* Si el repo es de un equipo, avisá antes del `--force`. Al que tenga cambios sin pushear le vas a romper la tarde.
:::

## Que no vuelva a pasar

Lo más barato es que el commit no salga. Un hook de pre-commit con `gitleaks` mira lo que estás por commitear y frena si encuentra algo con forma de secreto.

```yaml title=".pre-commit-config.yaml"
# frena el commit si encuentra algo con forma de secreto
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
        args: ["--redact"]
```

Y agregá :key[.env] al `.gitignore` antes del primer commit, con un `.env.example` sin valores para que se entienda qué variables hacen falta.

## El criterio

Si una key tocó un repo público, aunque sea un minuto, tratala como comprometida. No hay forma de probar que nadie la leyó, y rotarla cuesta menos que averiguarlo.

En la parte 3 vemos el mismo problema en GitHub Actions, donde el secreto no está en un archivo sino en los logs.
