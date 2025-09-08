# Use official Postgres image
FROM postgres:16

# Set environment variables
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=admin123
ENV POSTGRES_DB=mydb

# Copy init scripts (optional)
# Place .sql or .sh files in docker-entrypoint-initdb.d/
# COPY ./initdb /docker-entrypoint-initdb.d/

# Expose port
EXPOSE 5432
