#!/usr/bin/env bash
# create_swap.sh – crée un fichier swap et l'active
# Usage: sudo bash create_swap.sh [size]
# Example: sudo bash create_swap.sh 2G   # crée 2 GiB de swap

set -e

SWAPFILE=/swapfile
SIZE=${1:-2G}

# Vérifier si le swap existe déjà
if grep -q "${SWAPFILE}" /proc/swaps; then
  echo "Swap déjà actif sur ${SWAPFILE}."
  exit 0
fi

# Crée le fichier de swap
sudo fallocate -l $SIZE $SWAPFILE || sudo dd if=/dev/zero of=$SWAPFILE bs=1M count=$(echo $SIZE | sed 's/G//')

# Sécurise le fichier
sudo chmod 600 $SWAPFILE

# Initialise le swap
sudo mkswap $SWAPFILE

# Active le swap
sudo swapon $SWAPFILE

echo "${SWAPFILE} none swap sw 0 0" | sudo tee -a /etc/fstab

# Affiche le statut
free -h
