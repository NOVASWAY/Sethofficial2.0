#!/bin/bash

# Cloud Storage Configuration Script
# This script helps configure cloud storage (AWS S3, GCP, Azure)

set -e

echo "=========================================="
echo "Cloud Storage Configuration"
echo "=========================================="
echo ""

ENV_FILE="backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from env.example..."
    cp backend/env.example "$ENV_FILE"
fi

echo "Current storage configuration:"
echo "---------------------------"
grep -E "^(STORAGE_|AWS_|GCP_|AZURE_)" "$ENV_FILE" || echo "No cloud storage configuration found"
echo ""

read -p "Do you want to configure cloud storage? (y/n): " configure
if [ "$configure" != "y" ]; then
    echo "Skipping cloud storage configuration."
    echo "System will use local storage."
    exit 0
fi

echo ""
echo "Choose storage provider:"
echo "1) AWS S3"
echo "2) Google Cloud Storage (GCS)"
echo "3) Azure Blob Storage"
read -p "Enter choice (1-3): " provider_choice

case $provider_choice in
    1)
        echo ""
        echo "AWS S3 Configuration"
        echo "Get credentials from: https://console.aws.amazon.com/iam/"
        echo ""
        read -p "AWS Access Key ID: " access_key
        read -sp "AWS Secret Access Key: " secret_key
        echo ""
        read -p "AWS Region (e.g., us-east-1): " region
        read -p "S3 Bucket Name: " bucket
        
        # Update .env file
        sed -i "s|^STORAGE_PROVIDER=.*|STORAGE_PROVIDER=aws|" "$ENV_FILE" || echo "STORAGE_PROVIDER=aws" >> "$ENV_FILE"
        sed -i "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$access_key|" "$ENV_FILE" || echo "AWS_ACCESS_KEY_ID=$access_key" >> "$ENV_FILE"
        sed -i "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$secret_key|" "$ENV_FILE" || echo "AWS_SECRET_ACCESS_KEY=$secret_key" >> "$ENV_FILE"
        sed -i "s|^AWS_REGION=.*|AWS_REGION=$region|" "$ENV_FILE" || echo "AWS_REGION=$region" >> "$ENV_FILE"
        sed -i "s|^AWS_S3_BUCKET=.*|AWS_S3_BUCKET=$bucket|" "$ENV_FILE" || echo "AWS_S3_BUCKET=$bucket" >> "$ENV_FILE"
        ;;
    2)
        echo ""
        echo "Google Cloud Storage Configuration"
        echo "Get credentials from: https://console.cloud.google.com/iam-admin/serviceaccounts"
        echo ""
        read -p "GCP Project ID: " project_id
        read -p "GCS Bucket Name: " bucket
        read -p "Service Account JSON Key Path: " key_path
        
        # Update .env file
        sed -i "s|^STORAGE_PROVIDER=.*|STORAGE_PROVIDER=gcp|" "$ENV_FILE" || echo "STORAGE_PROVIDER=gcp" >> "$ENV_FILE"
        sed -i "s|^GCP_PROJECT_ID=.*|GCP_PROJECT_ID=$project_id|" "$ENV_FILE" || echo "GCP_PROJECT_ID=$project_id" >> "$ENV_FILE"
        sed -i "s|^GCS_BUCKET=.*|GCS_BUCKET=$bucket|" "$ENV_FILE" || echo "GCS_BUCKET=$bucket" >> "$ENV_FILE"
        sed -i "s|^GCP_SERVICE_ACCOUNT_KEY=.*|GCP_SERVICE_ACCOUNT_KEY=$key_path|" "$ENV_FILE" || echo "GCP_SERVICE_ACCOUNT_KEY=$key_path" >> "$ENV_FILE"
        ;;
    3)
        echo ""
        echo "Azure Blob Storage Configuration"
        echo "Get credentials from: https://portal.azure.com/"
        echo ""
        read -p "Azure Storage Account Name: " account_name
        read -sp "Azure Storage Account Key: " account_key
        echo ""
        read -p "Container Name: " container
        
        # Update .env file
        sed -i "s|^STORAGE_PROVIDER=.*|STORAGE_PROVIDER=azure|" "$ENV_FILE" || echo "STORAGE_PROVIDER=azure" >> "$ENV_FILE"
        sed -i "s|^AZURE_STORAGE_ACCOUNT=.*|AZURE_STORAGE_ACCOUNT=$account_name|" "$ENV_FILE" || echo "AZURE_STORAGE_ACCOUNT=$account_name" >> "$ENV_FILE"
        sed -i "s|^AZURE_STORAGE_KEY=.*|AZURE_STORAGE_KEY=$account_key|" "$ENV_FILE" || echo "AZURE_STORAGE_KEY=$account_key" >> "$ENV_FILE"
        sed -i "s|^AZURE_CONTAINER=.*|AZURE_CONTAINER=$container|" "$ENV_FILE" || echo "AZURE_CONTAINER=$container" >> "$ENV_FILE"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Cloud storage configuration updated in $ENV_FILE"
echo ""
echo "⚠️  Note: Cloud storage integration requires additional code implementation."
echo "    Currently, the system uses local storage by default."
echo "    Cloud storage can be used for backups and file uploads."

