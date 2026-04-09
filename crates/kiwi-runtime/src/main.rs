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
            let mut binary_path = None;
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
                    "--binary-path" => {
                        let Some(value) = args.next() else {
                            return Err(anyhow!("--binary-path requires a value"));
                        };
                        binary_path = Some(value);
                    }
                    other => {
                        return Err(anyhow!("unsupported runtime argument: {other}"));
                    }
                }
            }

            let metadata_file = metadata_file
                .ok_or_else(|| anyhow!("daemon requires --metadata-file <path>"))?;
            run_daemon(metadata_file, launch_mode, binary_path).await
        }
        other => Err(anyhow!("unsupported runtime command: {other}")),
    }
}
