#!/bin/sh

pnpm build
pnpm predeploy
exec "$@"
