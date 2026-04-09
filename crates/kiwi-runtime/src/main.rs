use anyhow::{anyhow, Result};
use kiwi_runtime::daemon::run_daemon;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let Some(command) = args.next() else {
        return Err(anyhow!(
            "usage: kiwi-control-runtime daemon --metadata-file <path>"
        ));
    };

    match command.as_str() {
        "daemon" => {
            let mut metadata_file = None;
            let mut launch_mode = None;
            let mut caller_surface = None;
            let mut packaging_source_category = None;
            let mut binary_path = None;
            let mut target_triple = None;
            while let Some(argument) = args.next() {
                match argument.as_str() {
                    "--metadata-file" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--metadata-file requires a value"));
                        };
                        metadata_file = Some(PathBuf::from(value));
                    }
                    "--launch-mode" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--launch-mode requires a value"));
                        };
                        launch_mode = Some(value);
                    }
                    "--caller-surface" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--caller-surface requires a value"));
                        };
                        caller_surface = Some(value);
                    }
                    "--packaging-source-category" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--packaging-source-category requires a value"));
                        };
                        packaging_source_category = Some(value);
                    }
                    "--binary-path" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--binary-path requires a value"));
                        };
                        binary_path = Some(value);
                    }
                    "--target-triple" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--target-triple requires a value"));
                        };
                        target_triple = Some(value);
                    }
                    other => {
                        return Err(anyhow!("unsupported runtime argument: {other}"));
                    }
                }
            }

            let metadata_file = metadata_file
                .ok_or_else(|| anyhow!("daemon requires --metadata-file <path>"))?;
            run_daemon(
                metadata_file,
                launch_mode,
                caller_surface,
                packaging_source_category,
                binary_path,
                target_triple,
            )
            .await
        }
        other => Err(anyhow!("unsupported runtime command: {other}")),
    }
}
