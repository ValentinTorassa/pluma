Te sale un 403, buscás el error y la primera respuesta dice `chmod 777`. Funciona, y ese es el problema: arregla el síntoma abriendo el archivo a todo el mundo.

## Cómo leer ls -l

Cada archivo tiene un dueño, un grupo y el resto. Para cada uno hay tres permisos: leer, escribir y ejecutar.

```bash
$ ls -l config.env
-rw-r----- 1 valen devs 214 sep  2 10:14 config.env
```

::figure{name="chmod"}

## Qué número elegir

Cada fila suma un número: 4 para leer, 2 para escribir, 1 para ejecutar. `640` es "yo leo y escribo, el grupo lee, el resto nada".

:::aside
*Para un archivo con secretos*, `600` suele alcanzar: solo vos.
:::

## El criterio

Si un permiso arregla el error pero no sabés por qué, todavía no lo arreglaste.
