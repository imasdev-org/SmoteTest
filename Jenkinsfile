pipeline {
    agent any

    tools {
        nodejs 'node-lts'
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Install dependencies') {
            steps {
                sh 'npm ci'
                sh 'npx playwright install chromium --with-deps'
                sh 'npx playwright install webkit --with-deps'
            }
        }

        stage('Generate BDD tests') {
            steps {
                sh 'npx bddgen'
            }
        }

        stage('Run Smoke Tests') {
            steps {
                script {
                    def status = sh(script: 'npx playwright test', returnStatus: true)
                    if (status != 0) {
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }
    }

    post {
        always {
            junit testResults: 'test-results/junit-results.xml', allowEmptyResults: true

            publishHTML(target: [
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Smoke Test Report',
                keepAll: true,
                alwaysLinkToLastBuild: true,
                allowMissing: true,
            ])
        }
    }
}
