Pasa así: subís la aplicación al server, entrás desde el navegador y te salta un 403. Buscás el error y la primera respuesta dice `chmod -R 777`. Lo corrés y anda.

Y ese es exactamente el problema. Funcionó, así que parece que estaba bien. Pero no arreglaste el permiso: lo sacaste del medio, y de paso le diste permiso de escritura a todos los procesos de la máquina sobre los archivos de :you[tu] aplicación.

El 403 casi nunca viene del permiso del archivo, y hay dos comandos que te muestran de dónde viene antes de tocar nada.

## Qué acabás de hacer

En Linux cada archivo le responde a tres audiencias distintas: el dueño, el grupo y el resto. Para cada una hay tres permisos: leer, escribir y ejecutar. Nueve casilleros en total.

`777` llena los nueve. En un servidor, "el resto" es cada proceso que corre en esa máquina. El servidor web, la base, el cron de backup, y cualquier cosa que haya entrado por una vulnerabilidad de otro servicio. A todos ellos les acabás de dar permiso de escritura.

Si además ese directorio está dentro de la raíz del sitio, cualquiera de esos procesos puede dejar un archivo ahí y pedirle al servidor que lo ejecute. Ese es el camino corto entre "no me andaba" y "me minan cripto en el server".

## Cómo se lee `ls -l`

```bash
$ ls -l config.env
-rw-r----- 1 valen devs 214 sep  2 10:14 config.env
```

Los primeros diez caracteres son el mapa entero. El primero dice qué es (`-` archivo, `d` directorio, `l` enlace). Los nueve que siguen son tres grupos de tres, en orden: dueño, grupo, resto.

::figure{name="chmod" caption="Los nueve casilleros de config.env, y el número que les corresponde."}

Acá `rw-` para `valen`, `r--` para el grupo `devs`, y `---` para el resto. En castellano: yo leo y escribo, cualquiera del grupo `devs` lee, y nadie más lo toca. Eso es :safe[640].

## Los números

Cada permiso vale un número: 4 leer, 2 escribir, 1 ejecutar. Se suman por audiencia y quedan tres dígitos.

| Octal | Dueño | Grupo | Resto | Para qué |
| --- | --- | --- | --- | --- |
| :safe[600] | rw- | --- | --- | Un archivo con secretos: sólo vos |
| :safe[640] | rw- | r-- | --- | Config que el grupo necesita leer |
| :safe[644] | rw- | r-- | r-- | Un archivo estático público |
| :safe[750] | rwx | r-x | --- | Un directorio o script del grupo |
| :exp[777] | rwx | rwx | rwx | Ningún caso real |

:::aside
*Para un `.env`*, :safe[600] y listo. Si el servidor web necesita leerlo, fijate con qué usuario corre: casi siempre es el equivocado.
:::

## La `x` en un directorio significa otra cosa

Acá está la confusión que genera la mayoría de los 403, y es la razón por la que `777` "funciona" sin que nadie entienda por qué.

En un archivo, la `x` significa ejecutar. En un directorio significa atravesarlo: poder pasar por él para llegar a lo que hay adentro. Son cosas distintas con la misma letra.

Eso tiene una consecuencia que sorprende: un directorio con `r--` te deja listar los nombres de lo que contiene, pero no abrir ni uno solo. Y un directorio con `--x` no te deja listar nada, pero si sabés el nombre exacto del archivo, lo abrís sin problema.

Por eso un permiso perfecto en el archivo final no alcanza. El proceso tiene que poder atravesar cada directorio del camino:

```bash
$ namei -l /var/www/app/uploads/foto.jpg
f: /var/www/app/uploads/foto.jpg
 drwxr-xr-x root  root  /
 drwxr-xr-x root  root  var
 drwxr-xr-x root  root  www
 drwxr-x--- deploy deploy app      ← acá se corta
 drwxr-xr-x deploy deploy uploads
 -rw-r--r-- deploy deploy foto.jpg
```

El archivo está en `644`, perfectamente legible. Pero `app` es `750` y pertenece a `deploy`, y el servidor web corre como `www-data`, que no está en ese grupo. No puede atravesar `app`, así que nunca llega a `foto.jpg`. `namei -l` es la herramienta que te muestra esto de un saque, y es lo primero que abriría antes de tocar ningún permiso.

## Casi siempre es un problema de dueño

Cuando `777` arregla un 403, lo que pasó es que tapaste un problema de pertenencia. El proceso corre como un usuario que no tiene nada que ver con el dueño de los archivos.

La pregunta útil son dos comandos:

```bash
$ ps -o user= -C nginx | sort -u    # ¿como quién corre?
www-data
$ stat -c '%U %G %a' /var/www/app   # ¿de quién es y cómo está?
deploy deploy 750
```

Ahí se ve solo: `www-data` contra `deploy deploy 750`. La salida es que los dos se conozcan, sin abrir el directorio a todo el mundo:

```bash
$ sudo chown -R deploy:www-data /var/www/app
$ sudo chmod -R 750 /var/www/app
```

Ahora el dueño sigue siendo `deploy`, el grupo pasa a ser `www-data`, y el servidor entra por la puerta del grupo. El resto sigue afuera. El error desaparece igual que con `777`, con la diferencia de que sabés por qué.

## Si ya corriste el 777

No hace falta adivinar qué tocaste. `find` te lo dice, y te lo arregla:

```bash
$ find /var/www/app -type f -perm 0777      # ver primero
$ find /var/www/app -type d -exec chmod 750 {} +
$ find /var/www/app -type f -exec chmod 640 {} +
```

Directorios y archivos por separado, porque necesitan cosas distintas: los directorios llevan la `x` para poder atravesarse, los archivos no.

:::aside
*Si el `777` estuvo puesto un tiempo en una máquina con cara a internet*, cambiar el permiso no cierra el tema. Lo que haya escrito alguien en ese rato sigue ahí.
:::

## El criterio

Antes de tocar un permiso, respondé tres preguntas: quién es el dueño, qué grupo necesita entrar y qué pasa si entra alguien más.

Si `777` te sacó un 403, el problema sigue ahí: corré `namei -l` sobre la ruta y fijate en qué directorio se corta.
