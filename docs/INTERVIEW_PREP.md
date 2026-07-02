# Ground Station DevOps / SRE Interview Preparation Guide
## 50 Technical Q&As for Senior Engineering Positions

This guide contains 50 interview questions with detailed answers covering Cloud Architecture, Kubernetes, Terraform, FastAPI, PostgreSQL, Observability, and Systems Design.

---

### Python & FastAPI

#### 1. What are the key benefits of using FastAPI over Django or Flask for high-performance ground station gateways?
FastAPI is built on top of Starlette and Pydantic, enabling asynchronous request handling using Python's `async/await` syntax. It utilizes ASGI (Asynchronous Server Gateway Interface) instead of WSGI, allowing it to handle concurrent WebSockets and long-lived streaming connections (such as real-time satellite telemetry ingestion) with performance comparable to Go and Node.js. Pydantic handles automatic data serialization, deserialization, and JSON schema validation out-of-the-box.

#### 2. Explain how dependency injection works in FastAPI and how we used it in our ground station.
FastAPI features a built-in Dependency Injection system using `Depends()`. Dependencies can manage database session lifetimes, execute OAuth2 authentication guards, and check user roles (RBAC). In our project, `get_current_user` and `check_role` are injected into route parameters, allowing the route logic to cleanly receive authenticated payloads without repeating authorization code.

#### 3. How does FastAPI handle concurrent WebSocket connections?
FastAPI is an ASGI framework. Each incoming WebSocket connection is handled concurrently as an asynchronous event loop task. Uvicorn (the ASGI server) manages the socket connections, allowing the application to maintain thousands of persistent, concurrent connections without blocking the main thread.

#### 4. What is the difference between standard threads and asyncio tasks in Python?
Threads are managed by the operating system kernel and are subject to the Global Interpreter Lock (GIL) in Python, meaning only one thread executes bytecode at a time. `asyncio` utilizes cooperative multitasking on a single thread. Tasks yield control explicitly using `await`, allowing the single-threaded event loop to handle other I/O operations (like database queries or WebSocket broadcasts) while waiting, resulting in lower memory footprint and context-switching overhead.

#### 5. How do you implement robust error handling in asynchronous SQLAlchemy?
You wrap operations in `try/except` blocks, explicitly call `await session.rollback()` on exceptions, and ensure sessions are closed using context managers (like `async with async_session()`). We also use connection pool parameters like `pool_pre_ping=True` to automatically test database connectivity before executing queries, preventing stale connection errors.

---

### Docker & Containerization

#### 6. What is a multi-stage Docker build, and why did we implement it for the React frontend?
A multi-stage build uses multiple `FROM` statements in a single Dockerfile. The first stage (using `node:18-alpine`) installs dependencies and compiles the source code into static files (`dist`). The second stage (using `nginx:alpine`) copies only the compiled static assets into the Nginx public directory. This keeps the final production image size extremely small (typically <50MB) and secure, as compiler tools and source files are excluded.

#### 7. How do you configure a container to run as a non-root user, and why is this critical?
By using the `USER` directive in the Dockerfile (e.g., `RUN adduser -D myuser && USER myuser`). Running as root inside a container poses a significant security vulnerability: if a process escapes the container, it obtains root access to the underlying host node.

#### 8. What is the difference between Docker image layers and cache invalidation?
Every instruction in a Dockerfile (e.g., `RUN`, `COPY`, `ADD`) creates a read-only cache layer. Docker matches cached layers sequentially during subsequent builds. If a file copied by a `COPY` command changes, that layer and all subsequent layers are invalidated, requiring rebuilt cache states. To optimize cache efficiency, copy package dependency files (like `requirements.txt` or `package.json`) and run install commands *before* copying the application source code.

#### 9. How do you handle container configuration files and secrets securely without hardcoding?
By injecting them as environment variables at container launch. In Kubernetes, this is achieved by referencing `ConfigMap` values and `Secret` keys inside the pod specification, which maps them into the container's environment variables.

#### 10. How does Docker's bridge network differ from the host network?
A bridge network isolates containers within a virtual private network on the host, mapping specified ports via NAT rules. A host network runs the container directly in the host's network namespace, exposing container ports directly on the host interface with zero network virtualization overhead.

---

### Kubernetes Orchestration

#### 11. What is the role of Liveness and Readiness probes in Kubernetes?
- **Liveness probes**: Monitor if the containerized application is running. If the probe fails (e.g. app deadlocks), kubelet restarts the container.
- **Readiness probes**: Determine if the container is ready to accept user network traffic. If it fails, the pod is removed from Service endpoint listings, preventing users from receiving HTTP errors.

#### 12. Explain the flow of a Horizontal Pod Autoscaler (HPA) scaling event.
The HPA controller queries resource metrics (CPU/Memory) from the `metrics-server` API at regular intervals (default 15s). It calculates the target replica count: `desiredReplicas = ceil[currentReplicas * (currentMetricValue / targetMetricValue)]`. If the metric exceeds the threshold (e.g., 80% CPU usage), the HPA updates the replica count in the target Deployment manifest, prompting the deployment controller to spin up new pods.

#### 13. What is the difference between a ClusterIP, NodePort, and LoadBalancer Service type?
- **ClusterIP**: Exposes the service on a cluster-internal IP address, making it accessible only within the cluster.
- **NodePort**: Exposes the service on each Node's IP at a static port (30000-32767), allowing external routing to that node.
- **LoadBalancer**: Provisions an external load balancer in the cloud (like AWS ELB) that routes traffic to the service.

#### 14. What are Persistent Volumes (PV) and Persistent Volume Claims (PVC)?
A PV is a cluster-wide storage resource provisioned by an administrator or dynamically through Storage Classes (e.g., AWS EBS). A PVC is a request for storage by a user/pod. PVCs bind to matching PVs, allowing pods to mount persistent volumes independently of the lifecycle of individual pods.

#### 15. How do you ensure Kubernetes secret values are secure at rest in a cluster?
By enabling Secret Encryption at Rest on the Kubernetes API-server, or by integrating external KMS keys (like AWS KMS) to encrypt secrets stored within the `etcd` database.

#### 16. What is a Headless Service in Kubernetes and when is it used?
A service with `clusterIP: None`. Instead of returning a single ClusterIP, the Kubernetes DNS server returns a list of A records mapping directly to the individual pod IPs. This is used for stateful applications (like database clusters or Elasticsearch) that require direct peer-to-peer routing.

#### 17. Explain Kubernetes RBAC and the difference between Role and ClusterRole.
Role-Based Access Control restricts API operations using Roles and RoleBindings.
- **Role**: Defines permissions (verbs/resources) restricted to a specific Namespace.
- **ClusterRole**: Defines permissions scoped cluster-wide (e.g., node management) or across all namespaces.

#### 18. How do you prevent a single Pod from consuming all node resources?
By defining resource `limits` (maximum CPU/Memory a container can consume) alongside resource `requests` (minimum guaranteed resources allocated to schedule the pod).

#### 19. What is a NetworkPolicy in Kubernetes?
A NetworkPolicy acts as a firewall for pods, defining ingress and egress rules based on pod selectors, namespaces, and CIDR blocks to restrict internal cluster communication.

#### 20. How does the Ingress Controller routing differ from a standard Service?
An Ingress Controller is an application (like Nginx) running in the cluster that acts as a reverse proxy, parsing HTTP rules to route external traffic to different Services based on domain hosts and URL paths.

---

### Terraform & Infrastructure as Code

#### 21. What is Terraform State (`terraform.tfstate`), and why must it be secured and locked?
The state file records the mapping of real-world infrastructure resources to your configuration files. It must be secured (using S3 with KMS encryption) because it contains sensitive data like database passwords and private keys. We implement state locking (using DynamoDB) to prevent concurrent executions from corrupting the state file.

#### 22. What are Terraform Modules and what are their benefits?
Modules are self-contained packages of Terraform configurations that group resources together. They enable reusability, standardize deployment configurations (like securing VPC setups), and simplify code maintenance across environments.

#### 23. What is the difference between `terraform plan` and `terraform apply`?
- `terraform plan`: Generates an execution plan by checking the current state of infrastructure against your configuration code, showing what changes will be made without modifying resources.
- `terraform apply`: Executes the proposed changes to reach the desired state.

#### 24. How do you handle secrets (like database passwords) in Terraform config?
By using variables marked as `sensitive = true`, or by pulling secrets dynamically at runtime from external secret managers (like AWS Secrets Manager) using data sources.

#### 25. Explain the concept of Terraform "Providers".
Providers are plugins that translate Terraform API calls into cloud-specific API requests (e.g. AWS, Azure, Google Cloud, Kubernetes).

---

### Observability, Prometheus & Grafana

#### 26. What is the pull model in Prometheus, and how does it compare to push models?
Prometheus pulls (scrapes) metrics from target applications via HTTP GET requests at regular intervals. In contrast, push models require applications to send metrics to a central server. The pull model keeps the target application lightweight and prevents metric servers from being overwhelmed by spikes in application traffic.

#### 27. What are the four core Prometheus metric types?
- **Counter**: A cumulative metric that only increases or resets to zero (e.g. HTTP requests count).
- **Gauge**: A metric representing a single numerical value that can go up or down (e.g. memory usage, battery level).
- **Histogram**: Samples observations (usually durations or sizes) and counts them in configurable buckets.
- **Summary**: Similar to histogram, but calculates configurable quantiles over a sliding time window.

#### 28. What is Grafana Provisioning?
A feature that allows you to define dashboards, data sources, and alert rules using YAML configuration files instead of creating them manually in the UI, enabling dashboards to be tracked in Git.

#### 29. How do you monitor database connection pools?
By exporting connection pool metrics (active connections, idle connections, wait times) to Prometheus and setting up alerts for pool exhaustion.

#### 30. How would you configure Prometheus alert routing?
Using Alertmanager, which receives alerts from Prometheus, groups/deduplicates them, and routes them to notification channels like Slack, PagerDuty, or Webhooks.

---

### ELK Logging Stack

#### 31. Explain the roles of Elasticsearch, Logstash, and Kibana.
- **Elasticsearch**: A distributed search and analytics engine where log data is stored, indexed, and queried.
- **Logstash**: A log ingestion pipeline that receives logs, parses/filters them (e.g., extract fields), and outputs them to Elasticsearch.
- **Kibana**: A visualization web interface that queries Elasticsearch to build graphs, dashboards, and log views.

#### 32. What is an Elasticsearch Index Template?
A template containing settings and mapping configurations that automatically apply to newly created indices.

#### 33. How does Logstash handle multi-line log events (like stack traces)?
By using the Logstash multiline codec or Filebeat configuration, which merges consecutive lines matching a specific pattern into a single log event.

#### 34. What is Logstash Grok filter?
A regex-based parsing engine that structures unstructured text logs into queryable fields (e.g. extracting IP addresses, log levels, and status codes).

#### 35. How do you optimize Elasticsearch for high-volume logs?
By using index lifecycle management (ILM) to roll over indices, setting proper index sharding, and utilizing SSD storage.

---

### CI/CD & Systems Design

#### 36. What is the difference between Continuous Integration (CI) and Continuous Deployment (CD)?
- **CI**: Automates code integration, building, linting, and testing on repository pushes to catch bugs early.
- **CD**: Automates the release of the code to production environments once it passes CI checks.

#### 37. What is a GitOps workflow, and how does it differ from traditional CI/CD?
In GitOps, Git is the single source of truth for the desired state of infrastructure. Agents (like ArgoCD) continuously monitor the Git repository and pull changes to sync the cluster state, whereas traditional CI/CD pushes changes to the cluster.

#### 38. How do you implement Zero-Downtime deployments in Kubernetes?
By using a `RollingUpdate` strategy. Kubernetes spins up new version pods and waits for them to pass readiness probes before terminating old pods, ensuring traffic is always routed to healthy containers.

#### 39. What is a Canary Deployment?
A deployment strategy where a new version is rolled out to a small subset of pods to test with a small percentage of traffic before completing the rollout.

#### 40. Explain the role of AWS IAM OpenID Connect (OIDC) providers in GitHub Actions.
It allows GitHub Actions to authenticate with AWS APIs using short-lived OpenID tokens instead of storing persistent, static AWS credentials as GitHub Secrets.

#### 41. How would you design a system to ingest telemetry from 10,000 satellites?
I would use a distributed message queue (like Apache Kafka) to buffer incoming payloads, processed by worker pods scaling horizontally in EKS, and store raw metrics in a time-series database (like TimescaleDB or InfluxDB).

#### 42. How do you handle database migrations in a production CI/CD pipeline?
By running migrations (e.g., using Alembic or Flyway) as a pre-deploy hook or Kubernetes Job before deploying the new backend version.

#### 43. What is the significance of Rate Limiting in API gateways?
It prevents denial-of-service (DoS) attacks and resource exhaustion by limiting the number of API calls a client can make within a given time frame.

#### 44. What is high availability (HA) in a cloud architecture?
Designing systems with redundancy, load balancing, and failover mechanisms across multiple Availability Zones to prevent single points of failure.

#### 45. Explain how JWT token authentication is secured.
Tokens are signed with a strong secret key (using HS256/RS256) to prevent tampering. They are kept short-lived and transmitted over HTTPS.

#### 46. What is a Circuit Breaker pattern in microservices?
A pattern that stops requests to a failing downstream service once a threshold of failures is reached, preventing system-wide cascading failures.

#### 47. Explain database partitioning and indexing.
- **Partitioning**: Splits large tables into smaller physical tables based on a key (e.g. time range) to speed up queries.
- **Indexing**: Creates data structures (like B-Trees) on specific columns to quickly look up rows.

#### 48. What is the CAP Theorem?
A distributed system can guarantee at most two of: Consistency, Availability, and Partition Tolerance.

#### 49. How do you secure data transmission between ground stations and satellites?
Using end-to-end encryption (AES-256 or custom aerospace protocols), digital signatures, and replay attack prevention using timestamp verification.

#### 50. What is Infrastructure Drift, and how does Terraform handle it?
Drift occurs when resources are modified outside of Terraform (e.g. in the cloud console). Running `terraform plan` refreshes the state against the cloud and proposes changes to bring the infrastructure back to the configured state.
